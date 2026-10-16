import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isTrue, isUnresolved, objectOf } from '../../src/domain/index.ts';
import { readOneSchema, schemaSource } from '../support/in-memory.ts';

const optionsOfFirstPath = (definition: string) =>
  readOneSchema(schemaSource(definition)).paths[0]!.options;

describe('value resolution', () => {
  it('reads literals of every shape an option is written in', () => {
    const options = optionsOfFirstPath(`{
      email: {
        type: String,
        unique: true,
        minlength: 3,
        default: null,
        enum: ['a', 'b'],
        partialFilterExpression: { email: { $type: 'string' } },
      },
    }`);

    assert.equal(isTrue(options['unique']), true);
    assert.deepEqual(options['minlength'], { kind: 'literal', value: 3 });
    assert.deepEqual(options['default'], { kind: 'literal', value: null });
    assert.deepEqual(options['enum'], { kind: 'literal', value: ['a', 'b'] });
    assert.deepEqual(objectOf(options['partialFilterExpression']), { email: { $type: 'string' } });
  });

  it('reads a negative number, which is half of every index declaration', () => {
    const options = optionsOfFirstPath(`{ score: { type: Number, min: -1 } }`);
    assert.deepEqual(options['min'], { kind: 'literal', value: -1 });
  });

  it('refuses a value that is not written in place', () => {
    const options = optionsOfFirstPath(`{ email: { type: String, unique: config.uniqueEmails } }`);

    assert.equal(isUnresolved(options['unique']), true);
    assert.equal(isTrue(options['unique']), false, 'unknown must never read as true');
  });

  it('refuses an object that a spread could have added keys to', () => {
    const options = optionsOfFirstPath(`{ email: { type: String, validate: { ...shared } } }`);
    assert.equal(isUnresolved(options['validate']), true);
  });
});
