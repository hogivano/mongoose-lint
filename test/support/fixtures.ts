/**
 * Running the real pipeline over the fixture directories.
 *
 * Rule tests go through the actual parser rather than hand-built models on
 * purpose: a rule that is right about a `SchemaModel` nobody can produce from
 * real source is not right about anything (the fixture pairs).
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ClockPort } from '../../src/application/ports.ts';
import { lint, type SeverityOverrides } from '../../src/application/index.ts';
import type { Finding, LintReport } from '../../src/domain/index.ts';
import { createCodebase } from '../../src/infrastructure/codebase/ts-morph-codebase.ts';
import { createRuleRegistry } from '../../src/infrastructure/rules/registry.ts';
import { createSchemaReader } from '../../src/infrastructure/schema/ts-morph-schema-reader.ts';

const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures');

/** A clock that does not move, so durations in reports are 0 and comparable. */
export function fixedClock(iso = '2026-01-01T00:00:00.000Z'): ClockPort {
  return { now: () => new Date(iso), elapsedMs: () => 0 };
}

/**
 * Lint one fixture directory with exactly one rule turned on.
 *
 * One rule at a time is the point: a fixture pair tests a rule, and a finding
 * from some other rule leaking into the count would hide the thing under test.
 */
export function lintFixture(directory: string, ruleId: string): LintReport {
  return lintFixtureWith(directory, { only: [ruleId], cli: { [ruleId]: 'error' } });
}

export function lintFixtureWith(directory: string, overrides: SeverityOverrides): LintReport {
  const codebase = createCodebase({ root: resolve(FIXTURES, directory) });

  return lint(
    {
      codebase,
      reader: createSchemaReader(codebase),
      registry: createRuleRegistry(),
      clock: fixedClock(),
    },
    { overrides, warn: () => {} },
  );
}

export function findingsIn(report: LintReport, file: string): Finding[] {
  return report.findings.filter((finding) => finding.location.file === file);
}

/** Every path a finding points at, for readable assertions. */
export function subjectsIn(report: LintReport, file: string): string[] {
  return findingsIn(report, file).map((finding) => finding.subject);
}
