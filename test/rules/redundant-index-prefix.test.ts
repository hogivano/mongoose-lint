import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findingsIn, lintFixture, subjectsIn } from '../support/fixtures.ts';

const RULE = 'redundant-index-prefix';
const report = lintFixture(RULE, RULE);

describe(RULE, () => {
  it('flags an index that a compound index already serves as a prefix', () => {
    assert.deepEqual(subjectsIn(report, 'violating.ts'), ['{ tenant: 1 }', '{ kind: 1 }']);
  });

  it('names the covering index in the message', () => {
    const [tenant] = findingsIn(report, 'violating.ts');
    assert.match(tenant?.message ?? '', /\{ tenant: 1, createdAt: -1 \}/);
  });

  it('does not flag a unique index covered by a wider compound index', () => {
    // { email: 1 } unique vs { email: 1, tenant: 1 }: different constraints.
    assert.deepEqual(findingsIn(report, 'clean.ts'), []);
  });
});
