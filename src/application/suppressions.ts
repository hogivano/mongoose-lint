/**
 * Applying inline disable comments to findings.
 *
 * Separated from the use case so the count of what was suppressed is a value
 * the report carries, not a number that disappears into a filter. A run that
 * is clean because of forty disable comments is not the same as a clean run,
 * and the report says so.
 */

import type { DisableDirective, Finding } from '../domain/index.ts';
import { suppresses } from '../domain/index.ts';

export interface Suppression {
  readonly kept: Finding[];
  readonly suppressed: Finding[];
}

export function applySuppressions(
  findings: readonly Finding[],
  directives: readonly DisableDirective[],
): Suppression {
  const kept: Finding[] = [];
  const suppressed: Finding[] = [];

  for (const finding of findings) {
    const silenced = directives.some(
      (directive) =>
        directive.file === finding.location.file &&
        suppresses(directive, finding.ruleId, finding.location.line),
    );
    (silenced ? suppressed : kept).push(finding);
  }

  return { kept, suppressed };
}
