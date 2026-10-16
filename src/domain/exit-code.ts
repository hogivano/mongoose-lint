import type { LintReport } from './report.ts';
import { errorsIn, warningsIn } from './report.ts';

/**
 * 0 clean · 1 findings · 2 error.
 *
 * Only `error`-severity findings fail the run. Warnings are the tool saying
 * "look at this", and a tool that fails a build over a heuristic gets removed
 * from the build. `--strict` additionally fails on warnings and on schemas the
 * parser could not read, for repos that want the stricter contract.
 */
export const EXIT = { CLEAN: 0, FINDINGS: 1, ERROR: 2 } as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

export interface ExitOptions {
  /** Warnings and unresolved schemas also fail. */
  strict?: boolean;
}

export function exitCodeFor(report: LintReport, options: ExitOptions = {}): ExitCode {
  if (errorsIn(report).length > 0) return EXIT.FINDINGS;
  if (options.strict !== true) return EXIT.CLEAN;
  return warningsIn(report).length > 0 || report.unresolved.length > 0
    ? EXIT.FINDINGS
    : EXIT.CLEAN;
}
