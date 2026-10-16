import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findingsIn, lintFixture, subjectsIn } from '../support/fixtures.ts';

const RULE = 'unique-on-optional-field';
const report = lintFixture(RULE, RULE);

describe(RULE, () => {
  it('flags every unique path that is not required, in source order', () => {
    assert.deepEqual(subjectsIn(report, 'violating.ts'), [
      'email',
      'referralCode',
      'profile.handle',
    ]);
  });

  it('notes when required is conditional rather than absent', () => {
    const conditional = findingsIn(report, 'violating.ts').find(
      (finding) => finding.subject === 'referralCode',
    );
    assert.match(conditional?.note ?? '', /conditional/);
  });

  it('suggests a partial index typed for the path', () => {
    const email = findingsIn(report, 'violating.ts')[0];
    assert.equal(
      email?.fix,
      "{ unique: true, partialFilterExpression: { email: { $type: 'string' } } }",
    );
  });

  it('finds nothing in the clean fixture', () => {
    assert.deepEqual(findingsIn(report, 'clean.ts'), []);
  });

  it('cites the MongoDB partial index documentation', () => {
    assert.match(findingsIn(report, 'violating.ts')[0]?.docs ?? '', /mongodb\.com\/docs/);
  });
});
