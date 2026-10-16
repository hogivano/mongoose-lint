/**
 * Inline disable comments.
 *
 *   // mongoose-lint-disable-next-line unique-on-optional-field
 *   // mongoose-lint-disable-file redundant-index-prefix
 *
 * Naming no rule disables every rule at that site. The rule id is optional but
 * always encouraged in the docs: a bare disable is how a suppression outlives
 * the reason for it.
 *
 * Suppressions are counted in the report rather than vanishing, so a repo can
 * see how much of its clean run is actually silence.
 */

export type DirectiveScope = 'next-line' | 'file';

export interface DisableDirective {
  readonly file: string;
  /** The line the comment is on. A `next-line` directive covers line + 1. */
  readonly line: number;
  readonly scope: DirectiveScope;
  /** Empty means "every rule". */
  readonly ruleIds: readonly string[];
}

export function suppresses(directive: DisableDirective, ruleId: string, line: number): boolean {
  const covers = directive.scope === 'file' || directive.line + 1 === line;
  const named = directive.ruleIds.length === 0 || directive.ruleIds.includes(ruleId);
  return covers && named;
}
