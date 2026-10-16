/**
 * The rule registry, and the invariants that types cannot express — checked
 * once, when the registry is built, so a broken rule fails on the first
 * command rather than in someone's CI.
 *
 * Ship order is the order here: the two deterministic rules first,
 * on by default, and everything else off until it has been proven quiet on a
 * real codebase.
 */

import type { RuleRegistryPort } from '../../application/ports.ts';
import type { Rule } from '../../application/rule.ts';
import { caseInsensitiveUnique } from './case-insensitive-unique.ts';
import { redundantIndexPrefix } from './redundant-index-prefix.ts';
import { refWithoutIndex } from './ref-without-index.ts';
import { unboundedArray } from './unbounded-array.ts';
import { uniqueOnOptionalField } from './unique-on-optional-field.ts';
import { uniquePartialFilterExists } from './unique-partial-filter-exists.ts';

export const ALL_RULES: readonly Rule[] = [
  // On by default: deterministic, and validated by hand on real schemas.
  uniqueOnOptionalField,
  redundantIndexPrefix,
  // Off by default: correct, but whether they apply is a decision about the
  // application, not about the schema.
  uniquePartialFilterExists,
  caseInsensitiveUnique,
  refWithoutIndex,
  // Off by default: heuristic.
  unboundedArray,
];

export function createRuleRegistry(rules: readonly Rule[] = ALL_RULES): RuleRegistryPort {
  validate(rules);
  const byId = new Map(rules.map((rule) => [rule.meta.id, rule]));

  return {
    all: () => rules,
    get: (ruleId) => byId.get(ruleId),
    has: (ruleId) => byId.has(ruleId),
  };
}

function validate(rules: readonly Rule[]): void {
  const seen = new Set<string>();

  for (const { meta } of rules) {
    if (seen.has(meta.id)) throw new Error(`duplicate rule id: ${meta.id}`);
    seen.add(meta.id);

    if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(meta.id)) {
      throw new Error(`rule ${meta.id}: id must be kebab-case`);
    }

    // The false-positive policy, as a runtime check: a heuristic can never be
    // an error, and can never be on by default.
    if (meta.confidence === 'heuristic' && meta.defaultSeverity !== 'off') {
      throw new Error(`rule ${meta.id}: heuristic rules must default to 'off'`);
    }

    // Every finding must be arguable on MongoDB's terms, not on ours.
    if (!meta.docs.startsWith('https://www.mongodb.com/docs/')) {
      throw new Error(`rule ${meta.id}: docs must link to the MongoDB manual`);
    }
  }
}
