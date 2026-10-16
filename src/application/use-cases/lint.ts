/**
 * `lint` — read the schemas, run the enabled rules, report what was found and
 * what could not be read.
 *
 * The two lists are kept apart on purpose. `findings` are claims about the
 * schema; `unresolved` are admissions about the parser. A linter that folded
 * the second into silence would report a clean run on a codebase it had
 * mostly skipped, which is the specific failure this tool refuses.
 */

import type { Finding, LintReport, RuleRun, UnresolvedSite } from '../../domain/index.ts';
import { compareFindings } from '../../domain/index.ts';
import { toFinding } from '../findings.ts';
import type { ClockPort, CodebasePort, RuleRegistryPort, SchemaReaderPort } from '../ports.ts';
import type { Rule } from '../rule.ts';
import { enabled, resolveSeverities, type SeverityOverrides } from '../severity-resolution.ts';
import { applySuppressions } from '../suppressions.ts';

export interface LintDeps {
  codebase: CodebasePort;
  reader: SchemaReaderPort;
  registry: RuleRegistryPort;
  clock: ClockPort;
}

export interface LintRequest {
  readonly overrides?: SeverityOverrides;
  /** Where a rule crash is announced. Defaults to stderr. */
  readonly warn?: (message: string) => void;
}

export function lint(deps: LintDeps, request: LintRequest = {}): LintReport {
  const startedAt = deps.clock.now().toISOString();
  const startMs = deps.clock.elapsedMs();

  const resolved = resolveSeverities(deps.registry, request.overrides);
  const active = enabled(resolved);
  const { schemas, unresolved, directives } = deps.reader.read();

  const findings: Finding[] = [];
  const counts = new Map<string, number>();

  for (const schema of schemas) {
    for (const { rule, severity } of active) {
      const matches = inspectSafely(rule, schema, request.warn);
      counts.set(rule.meta.id, (counts.get(rule.meta.id) ?? 0) + matches.length);
      for (const match of matches) {
        findings.push(toFinding(rule, match, schema, severity as 'error' | 'warn'));
      }
    }
  }

  const { kept, suppressed } = applySuppressions(findings.sort(compareFindings), directives);

  return {
    root: deps.codebase.root,
    filesScanned: deps.codebase.fileCount,
    schemasFound: schemas.length,
    startedAt,
    durationMs: deps.clock.elapsedMs() - startMs,
    rulesRun: active.map(
      ({ rule, severity }): RuleRun => ({
        ruleId: rule.meta.id,
        severity: severity as 'error' | 'warn',
        findings: counts.get(rule.meta.id) ?? 0,
      }),
    ),
    rulesSkipped: resolved
      .filter((entry) => entry.severity === 'off')
      .map((entry) => entry.rule.meta.id),
    findings: kept,
    unresolved: allUnresolved(schemas, unresolved),
    suppressed: suppressed.length,
  };
}

/** Schema-level and file-level gaps, in one list, in file order. */
function allUnresolved(
  schemas: readonly { unresolved: readonly UnresolvedSite[] }[],
  fileLevel: readonly UnresolvedSite[],
): UnresolvedSite[] {
  return [...schemas.flatMap((schema) => schema.unresolved), ...fileLevel].sort(
    (a, b) =>
      a.location.file.localeCompare(b.location.file) ||
      a.location.line - b.location.line ||
      a.location.column - b.location.column,
  );
}

/**
 * One rule tripping over an odd schema must not lose the other rules' results.
 * A throw here is a bug in that rule, so it is surfaced rather than swallowed.
 */
function inspectSafely(
  rule: Rule,
  schema: Parameters<Rule['inspect']>[0],
  warn: ((message: string) => void) | undefined,
) {
  try {
    return rule.inspect(schema);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const report = warn ?? ((message: string) => process.stderr.write(`${message}\n`));
    report(`mongoose-lint: rule ${rule.meta.id} failed on ${schema.name}: ${reason}`);
    return [];
  }
}
