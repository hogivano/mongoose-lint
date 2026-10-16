import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IndexDeclaration } from '../../src/domain/index.ts';
import { isConstrained, isIndexPrefixOf } from '../../src/domain/index.ts';
import { readOneSchema, schemaSource } from '../support/in-memory.ts';

const index = (
  keys: [string, 1 | -1][],
  options: Record<string, never> | Record<string, { kind: 'literal'; value: true }> = {},
): IndexDeclaration => ({
  keys: keys.map(([path, direction]) => ({ path, direction })),
  options,
  source: 'schema.index()',
  location: { file: 'model.ts', line: 1, column: 1 },
});

describe('index prefixes', () => {
  it('treats a leading subset as a prefix', () => {
    assert.equal(isIndexPrefixOf(index([['a', 1]]), index([['a', 1], ['b', 1]])), true);
  });

  it('does not treat a trailing key as a prefix — order is the whole point', () => {
    assert.equal(isIndexPrefixOf(index([['a', 1]]), index([['b', 1], ['a', 1]])), false);
  });

  it('ignores direction for a single key, which is traversable both ways', () => {
    assert.equal(isIndexPrefixOf(index([['a', -1]]), index([['a', 1], ['b', 1]])), true);
  });

  it('compares direction once there is more than one key', () => {
    const candidate = index([['a', 1], ['b', 1]]);
    const longer = index([['a', 1], ['b', -1], ['c', 1]]);
    assert.equal(isIndexPrefixOf(candidate, longer), false);
  });

  it('is never a prefix of an index of the same length', () => {
    assert.equal(isIndexPrefixOf(index([['a', 1]]), index([['a', 1]])), false);
  });
});

describe('constrained indexes', () => {
  it('recognises an index that enforces something of its own', () => {
    assert.equal(isConstrained(index([['a', 1]], { unique: { kind: 'literal', value: true } })), true);
    assert.equal(isConstrained(index([['a', 1]])), false);
  });
});

describe('indexes read from a schema', () => {
  it('collects both path options and schema.index() calls', () => {
    const schema = readOneSchema(
      [
        "import { Schema } from 'mongoose';",
        'export const TestSchema = new Schema({',
        '  email: { type: String, unique: true },',
        '  tenant: { type: String, index: true },',
        '});',
        'TestSchema.index({ tenant: 1, createdAt: -1 });',
      ].join('\n'),
    );

    assert.deepEqual(
      schema.indexes.map((declaration) => [declaration.source, declaration.keys.map((key) => key.path)]),
      [
        ['path-option', ['email']],
        ['path-option', ['tenant']],
        ['schema.index()', ['tenant', 'createdAt']],
      ],
    );
  });

  it('carries unique from the path onto the index it creates', () => {
    const schema = readOneSchema(schemaSource(`{ email: { type: String, unique: true } }`));
    assert.equal(isConstrained(schema.indexes[0]!), true);
  });

  it('ignores an index() call on something that is not the schema', () => {
    const schema = readOneSchema(
      [
        "import { Schema } from 'mongoose';",
        'export const TestSchema = new Schema({ a: String });',
        'somethingElse.index({ a: 1 });',
      ].join('\n'),
    );

    assert.deepEqual(schema.indexes, []);
  });
});
