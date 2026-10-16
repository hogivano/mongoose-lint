/**
 * The behaviour the whole tool is judged on: a schema it cannot read is
 * reported, never quietly passed.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lintFixtureWith } from '../support/fixtures.ts';
import { EXIT, exitCodeFor } from '../../src/domain/index.ts';

const report = lintFixtureWith('unresolved', {});

describe('unresolved schemas', () => {
  it('reports the spread, the unreadable path, and the factory-built schema', () => {
    assert.deepEqual(
      report.unresolved.map((site) => site.what),
      [
        'spread in a schema definition',
        'path "email" is not a literal definition',
        'schema definition is not an object literal',
      ],
    );
  });

  it('still lints the half of the schema it could read', () => {
    // `number` is unique and required, so there is nothing to report — the
    // point is that the readable paths were parsed at all.
    assert.equal(report.schemasFound, 1);
  });

  it('does not fail the run by default, and does under --strict', () => {
    assert.equal(exitCodeFor(report), EXIT.CLEAN);
    assert.equal(exitCodeFor(report, { strict: true }), EXIT.FINDINGS);
  });
});
