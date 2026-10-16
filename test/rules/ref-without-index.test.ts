import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findingsIn, lintFixture, subjectsIn } from '../support/fixtures.ts';

const RULE = 'ref-without-index';
const report = lintFixture(RULE, RULE);

describe(RULE, () => {
  it('flags a reference path with no index', () => {
    assert.deepEqual(subjectsIn(report, 'violating.ts'), ['author']);
  });

  it('accepts an index, a leading compound index, and unique', () => {
    assert.deepEqual(findingsIn(report, 'clean.ts'), []);
  });
});
