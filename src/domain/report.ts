/**
 * The report aggregate and the pure functions that summarise it.
 *
 * Nothing here formats or does I/O: `lint` builds this, the presentation layer
 * renders it, and tests assert on it directly.
 */

import { compareFindings, type Finding } from './finding.ts';
import type { UnresolvedSite } from './schema.ts';

export interface RuleRun {
  readonly ruleId: string;
  readonly severity: 'error' | 'warn';
  readonly findings: number;
}

export interface LintReport {
  readonly root: string;
  readonly filesScanned: number;
  readonly schemasFound: number;
  readonly startedAt: string;
  readonly durationMs: number;
  /** Rules that actually ran, with their resolved severity. */
  readonly rulesRun: readonly RuleRun[];
  /** Rules switched off, by id — printed so a quiet run is never mistaken for a clean one. */
  readonly rulesSkipped: readonly string[];
  readonly findings: readonly Finding[];
  /**
   * Everything the parser refused to guess at, from every file.
   * Never folded into `findings`: these are not problems with the schema, they
   * are gaps in what this run can claim.
   */
  readonly unresolved: readonly UnresolvedSite[];
  /** Findings suppressed by an inline comment. Counted, never listed as clean. */
  readonly suppressed: number;
}

export function errorsIn(report: LintReport): Finding[] {
  return report.findings.filter((finding) => finding.severity === 'error');
}

export function warningsIn(report: LintReport): Finding[] {
  return report.findings.filter((finding) => finding.severity === 'warn');
}

export function affectedFiles(findings: readonly Finding[]): number {
  return new Set(findings.map((finding) => finding.location.file)).size;
}

/** Findings grouped by rule, in report order, preserving order within a group. */
export function groupByRule(findings: readonly Finding[]): Map<string, Finding[]> {
  const groups = new Map<string, Finding[]>();
  for (const finding of [...findings].sort(compareFindings)) {
    const group = groups.get(finding.ruleId);
    if (group) group.push(finding);
    else groups.set(finding.ruleId, [finding]);
  }
  return groups;
}

/** Findings grouped by the schema they were found in, for the human report. */
export function groupBySchema(findings: readonly Finding[]): Map<string, Finding[]> {
  const groups = new Map<string, Finding[]>();
  for (const finding of [...findings].sort(compareFindings)) {
    const key = `${finding.location.file} ${finding.schema}`;
    const group = groups.get(key);
    if (group) group.push(finding);
    else groups.set(key, [finding]);
  }
  return groups;
}
