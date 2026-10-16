import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readOneSchema, schemaSource } from '../support/in-memory.ts';
import { uniquePartialFilterExists } from '../../src/infrastructure/rules/unique-partial-filter-exists.ts';

describe('unique-partial-filter-exists', () => {
  it('flags a partial unique index filtered on $exists', () => {
    const schema = readOneSchema(
      schemaSource(`{
        email: {
          type: String,
          unique: true,
          partialFilterExpression: { email: { $exists: true } },
        },
      }`),
    );

    const [match] = uniquePartialFilterExists.inspect(schema);
    assert.equal(match?.subject, 'email');
    assert.match(match?.fix ?? '', /\$type/);
  });

  it('accepts a filter on $type', () => {
    const schema = readOneSchema(
      schemaSource(`{
        email: {
          type: String,
          unique: true,
          partialFilterExpression: { email: { $type: 'string' } },
        },
      }`),
    );

    assert.deepEqual(uniquePartialFilterExists.inspect(schema), []);
  });

  it('says nothing about a path with no partial filter at all', () => {
    // That is rule 1's finding, not this one's. Two rules reporting the same
    // path twice is the fastest way to get both of them turned off.
    const schema = readOneSchema(schemaSource(`{ email: { type: String, unique: true } }`));
    assert.deepEqual(uniquePartialFilterExists.inspect(schema), []);
  });
});
