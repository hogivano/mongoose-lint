import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findingsIn, lintFixture, subjectsIn } from '../support/fixtures.ts';
import { unboundedArray } from '../../src/infrastructure/rules/unbounded-array.ts';

const RULE = 'unbounded-array';
const report = lintFixture(RULE, RULE);

describe(RULE, () => {
  it('flags arrays of subdocuments and of references', () => {
    assert.deepEqual(subjectsIn(report, 'violating.ts'), ['comments', 'subscribers']);
  });

  it('never flags arrays of primitives or arrays with a declared bound', () => {
    assert.deepEqual(findingsIn(report, 'clean.ts'), []);
  });

  it('says on every finding that it is a heuristic', () => {
    for (const finding of findingsIn(report, 'violating.ts')) {
      assert.match(finding.note ?? '', /heuristic/);
    }
  });

  it('is off by default and can never be an error by default', () => {
    assert.equal(unboundedArray.meta.defaultSeverity, 'off');
    assert.equal(unboundedArray.meta.confidence, 'heuristic');
  });
});
