import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findingsIn, lintFixture, subjectsIn } from '../support/fixtures.ts';

const RULE = 'case-insensitive-unique';
const report = lintFixture(RULE, RULE);

describe(RULE, () => {
  it('flags a unique String path with no case handling', () => {
    assert.deepEqual(subjectsIn(report, 'violating.ts'), ['email']);
  });

  it('accepts lowercase, a schema collation, and non-String paths', () => {
    assert.deepEqual(findingsIn(report, 'clean.ts'), []);
  });
});
