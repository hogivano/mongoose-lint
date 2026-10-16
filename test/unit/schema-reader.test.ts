/**
 * The parser. Everything else in the tool is downstream of these assertions
 * being true, which is why they are stated one shape at a time.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readOneSchema, readSchemas, schemaSource } from '../support/in-memory.ts';

const pathNames = (source: string) => readOneSchema(source).paths.map((path) => path.name);

describe('schema reader — paths', () => {
  it('reads a bare type, a type with options, and a nested group', () => {
    const names = pathNames(
      schemaSource(`{
        name: String,
        email: { type: String, unique: true },
        profile: { city: String, geo: { lat: Number } },
      }`),
    );

    assert.deepEqual(names, ['name', 'email', 'profile.city', 'profile.geo.lat']);
  });

  it('tells a type declaration from a path called "type"', () => {
    // `{ type: String }` is a declaration; `{ kind: String }` is a group.
    const schema = readOneSchema(
      schemaSource(`{ payment: { type: String }, address: { kind: String } }`),
    );

    assert.deepEqual(
      schema.paths.map((path) => [path.name, path.kind]),
      [
        ['payment', 'String'],
        ['address.kind', 'String'],
      ],
    );
  });

  it('reads ObjectId however it is spelled', () => {
    const schema = readOneSchema(
      schemaSource(`{
        a: { type: Schema.Types.ObjectId },
        b: { type: mongoose.Schema.Types.ObjectId },
        c: { type: 'ObjectId' },
      }`),
    );

    assert.deepEqual(schema.paths.map((path) => path.kind), ['ObjectId', 'ObjectId', 'ObjectId']);
  });

  it('reads arrays, and descends into inline subdocuments', () => {
    const schema = readOneSchema(
      schemaSource(`{
        tags: [String],
        comments: [{ body: String }],
        authors: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      }`),
    );

    assert.deepEqual(schema.paths.map((path) => path.name), [
      'tags',
      'comments.body',
      'comments',
      'authors',
    ]);

    const tags = schema.paths.find((path) => path.name === 'tags');
    assert.equal(tags?.element?.isSubdocument, false);

    const authors = schema.paths.find((path) => path.name === 'authors');
    assert.equal(authors?.element?.ref, 'User');
  });

  it('lifts options written on an array element onto the path', () => {
    const schema = readOneSchema(
      schemaSource(`{ authors: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }] }`),
    );

    assert.equal(schema.paths[0]?.options['index']?.kind, 'literal');
  });
});

describe('schema reader — what it refuses to guess', () => {
  it('reports a spread instead of parsing around it', () => {
    const schema = readOneSchema(schemaSource(`{ ...auditFields, name: String }`));

    assert.equal(schema.unresolved.length, 1);
    assert.match(schema.unresolved[0]?.what ?? '', /spread/);
    // The readable half is still read.
    assert.deepEqual(schema.paths.map((path) => path.name), ['name']);
  });

  it('reports a path whose definition is a variable', () => {
    const schema = readOneSchema(schemaSource(`{ email: emailField }`));

    assert.equal(schema.paths.length, 0);
    assert.match(schema.unresolved[0]?.what ?? '', /not a literal/);
  });

  it('reports a schema built by a factory, and produces no model for it', () => {
    const { schemas, unresolved } = readSchemas({
      'model.ts': [
        "import { Schema } from 'mongoose';",
        'export const S = new Schema(buildDefinition());',
      ].join('\n'),
    });

    assert.deepEqual(schemas, []);
    assert.equal(unresolved.length, 1);
    assert.match(unresolved[0]?.what ?? '', /not an object literal/);
  });

  it('records an unreadable option as unknown, not as false', () => {
    const schema = readOneSchema(schemaSource(`{ email: { type: String, unique: FLAGS.unique } }`));

    assert.equal(schema.paths[0]?.options['unique']?.kind, 'unresolved');
  });
});

describe('schema reader — what counts as a Mongoose schema', () => {
  it('ignores a Schema that did not come from mongoose', () => {
    const { schemas } = readSchemas({
      'graphql.ts': [
        "import { Schema } from 'some-graphql-library';",
        "export const S = new Schema({ email: { type: String, unique: true } });",
      ].join('\n'),
    });

    assert.deepEqual(schemas, []);
  });

  it('accepts every way mongoose is imported', () => {
    const { schemas } = readSchemas({
      'default.ts': [
        "import mongoose from 'mongoose';",
        'export const A = new mongoose.Schema({ a: String });',
      ].join('\n'),
      'named.ts': [
        "import { Schema as MongooseSchema } from 'mongoose';",
        'export const B = new MongooseSchema({ b: String });',
      ].join('\n'),
      'required.js': [
        "const { Schema } = require('mongoose');",
        'const C = new Schema({ c: String });',
      ].join('\n'),
    });

    assert.deepEqual(schemas.map((schema) => schema.name).sort(), ['A', 'B', 'C']);
  });

  it('follows a local alias of mongoose.Schema', () => {
    // The single most common idiom in Mongoose model files, and the one that
    // makes a matcher anchored only to imports report a clean run.
    const { schemas } = readSchemas({
      'alias.ts': [
        "import mongoose from 'mongoose';",
        'const Schema = mongoose.Schema;',
        'export const A = new Schema({ a: String });',
      ].join('\n'),
      'destructured.ts': [
        "import mongoose from 'mongoose';",
        'const { Schema: S } = mongoose;',
        'export const B = new S({ b: String });',
      ].join('\n'),
      'aliased-namespace.ts': [
        "import mongoose from 'mongoose';",
        'const db = mongoose;',
        'export const C = new db.Schema({ c: String });',
      ].join('\n'),
    });

    assert.deepEqual(schemas.map((schema) => schema.name).sort(), ['A', 'B', 'C']);
  });

  it('still ignores an alias of something that is not mongoose', () => {
    const { schemas } = readSchemas({
      'other.ts': [
        "import zod from 'some-other-library';",
        'const Schema = zod.Schema;',
        'export const A = new Schema({ a: String });',
      ].join('\n'),
    });

    assert.deepEqual(schemas, []);
  });

  it('names an anonymous schema after the model it is passed to', () => {
    const { schemas } = readSchemas({
      'model.ts': [
        "import mongoose from 'mongoose';",
        "export default mongoose.model('User', new mongoose.Schema({ a: String }));",
      ].join('\n'),
    });

    assert.equal(schemas[0]?.name, 'User');
  });
});
