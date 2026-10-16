import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EXIT, exitCodeFor, type Finding, type LintReport } from '../../src/domain/index.ts';

const finding = (severity: 'error' | 'warn'): Finding => ({
  ruleId: 'unique-on-optional-field',
  severity,
  title: 'unique: true on an optional field',
  docs: 'https://www.mongodb.com/docs/manual/core/index-partial/',
  location: { file: 'model.ts', line: 1, column: 1 },
  schema: 'UserSchema',
  subject: 'email',
  message: 'message',
});

const report = (findings: Finding[]): LintReport => ({
  root: '/repo',
  filesScanned: 1,
  schemasFound: 1,
  startedAt: '2026-01-01T00:00:00.000Z',
  durationMs: 0,
  rulesRun: [],
  rulesSkipped: [],
  findings,
  unresolved: [],
  suppressed: 0,
});

describe('exit codes', () => {
  it('fails on an error', () => {
    assert.equal(exitCodeFor(report([finding('error')])), EXIT.FINDINGS);
  });

  it('does not fail on a warning — a heuristic must not break a build', () => {
    assert.equal(exitCodeFor(report([finding('warn')])), EXIT.CLEAN);
  });

  it('fails on a warning under --strict', () => {
    assert.equal(exitCodeFor(report([finding('warn')]), { strict: true }), EXIT.FINDINGS);
  });

  it('is clean when there is nothing to say', () => {
    assert.equal(exitCodeFor(report([])), EXIT.CLEAN);
  });
});
