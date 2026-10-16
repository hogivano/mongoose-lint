/**
 * `rules` — show every rule, its severity for this run, and what it enforces.
 *
 * This is the tool explaining itself. Anyone deciding whether to trust a report
 * should be able to read the entire rule set, including the rules that are off,
 * in one screen.
 */

import type { AntiPatternId, Severity } from '../../domain/index.ts';
import type { RuleRegistryPort } from '../ports.ts';
import type { RuleConfidence } from '../rule.ts';
import { resolveSeverities, type SeverityOverrides } from '../severity-resolution.ts';

export interface RuleListing {
  readonly id: string;
  readonly confidence: RuleConfidence;
  readonly defaultSeverity: Severity;
  /** What it would be for this run, after config and flags. */
  readonly severity: Severity;
  readonly title: string;
  readonly antiPattern?: AntiPatternId;
  readonly docs: string;
  readonly explain: string;
}

export function listRules(
  registry: RuleRegistryPort,
  overrides: SeverityOverrides = {},
): RuleListing[] {
  return resolveSeverities(registry, overrides).map(({ rule, severity }) => ({
    id: rule.meta.id,
    confidence: rule.meta.confidence,
    defaultSeverity: rule.meta.defaultSeverity,
    severity,
    title: rule.meta.title,
    ...(rule.meta.antiPattern === undefined ? {} : { antiPattern: rule.meta.antiPattern }),
    docs: rule.meta.docs,
    explain: rule.meta.explain,
  }));
}
