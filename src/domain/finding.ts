/** One thing a rule found. The atom of every report. */

import type { AntiPatternId } from './anti-pattern.ts';
import type { SourceLocation } from './schema.ts';
import type { Severity } from './severity.ts';
import { severityRank } from './severity.ts';

export interface Finding {
  readonly ruleId: string;
  /** Resolved for this run: the rule's default, overridden by config. */
  readonly severity: Exclude<Severity, 'off'>;
  /** Copied from the rule so one finding is readable on its own. */
  readonly title: string;
  readonly antiPattern?: AntiPatternId;
  /** The MongoDB page this finding enforces. Every finding has one. */
  readonly docs: string;
  readonly location: SourceLocation;
  /** The schema it was found in, e.g. `UserSchema`. */
  readonly schema: string;
  /** What the finding is about: a path name, or index keys. */
  readonly subject: string;
  /** One line, specific to this site. Not the rule's general explanation. */
  readonly message: string;
  /** The concrete change that resolves it, as code. */
  readonly fix?: string;
  /** Why this site is less certain than the rule's usual match. */
  readonly note?: string;
}

/** Stable ordering: severity, then position. Reports must be diffable. */
export function compareFindings(a: Finding, b: Finding): number {
  return (
    severityRank(a.severity) - severityRank(b.severity) ||
    a.location.file.localeCompare(b.location.file) ||
    a.location.line - b.location.line ||
    a.location.column - b.location.column ||
    a.ruleId.localeCompare(b.ruleId)
  );
}
