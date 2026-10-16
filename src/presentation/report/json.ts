/**
 * `--json`, for CI.
 *
 * Flatter than the internal model: one findings array, one unresolved array,
 * and a summary block so the common question — "did anything fail?" — is a
 * field access rather than a reduce.
 *
 * `unresolved` is a top-level key, not a footnote inside the summary. A
 * pipeline that wants to fail on unreadable schemas should not have to know
 * this tool's internals to find them.
 */

import {
  affectedFiles,
  errorsIn,
  warningsIn,
  type LintReport,
} from '../../domain/index.ts';
import type { RuleListing } from '../../application/use-cases/list-rules.ts';

export function reportToJson(report: LintReport): string {
  return `${JSON.stringify(
    {
      version: 1,
      root: report.root,
      startedAt: report.startedAt,
      durationMs: Math.round(report.durationMs),
      filesScanned: report.filesScanned,
      schemasFound: report.schemasFound,
      summary: {
        errors: errorsIn(report).length,
        warnings: warningsIn(report).length,
        filesAffected: affectedFiles(report.findings),
        suppressed: report.suppressed,
        unresolved: report.unresolved.length,
      },
      rules: {
        run: report.rulesRun,
        off: report.rulesSkipped,
      },
      findings: report.findings,
      unresolved: report.unresolved,
    },
    null,
    2,
  )}\n`;
}

export function rulesToJson(rules: readonly RuleListing[]): string {
  return `${JSON.stringify({ version: 1, rules }, null, 2)}\n`;
}
