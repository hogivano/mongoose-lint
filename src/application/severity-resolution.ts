/**
 * Resolving each rule's severity for one run: the rule's default, then the
 * config file, then the command line.
 *
 * Kept apart from the use case because "which rules are on" is the question
 * users argue with, and it should be answerable — and testable — on its own.
 * An unknown rule id is an error at every level rather than a silent no-op: a
 * typo in a config that quietly disables nothing is indistinguishable from a
 * rule that never fires.
 */

import type { MongooseLintConfig, Severity } from '../domain/index.ts';
import { UnknownRuleError } from '../domain/index.ts';
import type { RuleRegistryPort } from './ports.ts';
import type { Rule } from './rule.ts';

export interface SeverityOverrides {
  /** From the config file's `rules` block. */
  readonly config?: Readonly<Record<string, Severity>>;
  /** From `--rule id=severity`. Wins over the config file. */
  readonly cli?: Readonly<Record<string, Severity>>;
  /** From `--only a,b`: everything unnamed is off, whatever the config says. */
  readonly only?: readonly string[];
}

export interface ResolvedRule {
  readonly rule: Rule;
  readonly severity: Severity;
}

export function resolveSeverities(
  registry: RuleRegistryPort,
  overrides: SeverityOverrides = {},
): ResolvedRule[] {
  assertKnown(registry, Object.keys(overrides.config ?? {}), 'config file');
  assertKnown(registry, Object.keys(overrides.cli ?? {}), '--rule');
  assertKnown(registry, overrides.only ?? [], '--only');

  return registry.all().map((rule) => ({ rule, severity: severityFor(rule, overrides) }));
}

function severityFor(rule: Rule, overrides: SeverityOverrides): Severity {
  if (overrides.only !== undefined && !overrides.only.includes(rule.meta.id)) return 'off';

  return (
    overrides.cli?.[rule.meta.id] ??
    overrides.config?.[rule.meta.id] ??
    rule.meta.defaultSeverity
  );
}

function assertKnown(registry: RuleRegistryPort, ids: readonly string[], source: string): void {
  const unknown = ids.filter((id) => !registry.has(id));
  if (unknown.length === 0) return;

  throw new UnknownRuleError(
    `${source}: unknown rule ${unknown.map((id) => `"${id}"`).join(', ')}`,
    'Run `mongoose-lint rules` for the list of rule ids.',
  );
}

/** Config helper: only the rules that will actually run. */
export function enabled(resolved: readonly ResolvedRule[]): ResolvedRule[] {
  return resolved.filter((entry) => entry.severity !== 'off');
}
