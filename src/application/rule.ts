/**
 * The rule contract. Rules are data: `{id, antiPattern, severity,
 * docsUrl, detect, explain}`.
 *
 * `inspect` takes a resolved `SchemaModel` and returns matches. It cannot
 * touch the file system, cannot see the AST, and cannot be non-deterministic —
 * which is what makes "run it on your own repo and check every finding by
 * hand" a realistic acceptance test rather than a slogan.
 *
 * Two constructors, and the difference between them is the whole
 * false-positive policy:
 *
 *   defineRule       deterministic. May ship as an error, and on by default.
 *   defineHeuristic  cannot be proven from a schema alone. Warning at most,
 *                    off by default, and its explanation must say why it might
 *                    be wrong.
 */

import type { AntiPatternId, SchemaModel, Severity, SourceLocation } from '../domain/index.ts';

export type RuleConfidence = 'deterministic' | 'heuristic';

export interface RuleMeta {
  /** Stable kebab-case id. Appears in --json, config, and disable comments. */
  readonly id: string;
  readonly confidence: RuleConfidence;
  /** Severity when the config says nothing. Heuristics default to 'off'. */
  readonly defaultSeverity: Severity;
  /** One line, the problem itself. e.g. "unique: true on an optional field". */
  readonly title: string;
  /** The MongoDB anti-pattern this enforces, when it is one of the six. */
  readonly antiPattern?: AntiPatternId;
  /** The MongoDB page a reader can check this against. Required. */
  readonly docs: string;
  /** Why it matters and what to do. Printed under the findings. */
  readonly explain: string;
}

/** One site a rule matched, in terms of the schema model. */
export interface RuleMatch {
  readonly location: SourceLocation;
  /** What this is about: a path name, or index keys. */
  readonly subject: string;
  /** One line about *this* site, not the rule in general. */
  readonly message: string;
  /** The concrete change that resolves it, as code. */
  readonly fix?: string;
  /** Why this particular site is less certain than the rule's usual match. */
  readonly note?: string;
}

export interface Rule {
  readonly meta: RuleMeta;
  /** Pure. Same schema in, same matches out, every time. */
  inspect(schema: SchemaModel): RuleMatch[];
}

interface RuleSpec {
  id: string;
  title: string;
  docs: string;
  antiPattern?: AntiPatternId;
  explain: string;
  inspect(schema: SchemaModel): RuleMatch[];
}

/**
 * A rule whose finding follows from the schema text alone.
 *
 * `defaultSeverity` is a choice, not a formality: ship a rule on by default
 * only once it has been run against a real codebase and every finding was one
 * a human confirmed.
 */
export function defineRule(spec: RuleSpec & { defaultSeverity: Severity }): Rule {
  return { meta: meta(spec, 'deterministic', spec.defaultSeverity), inspect: spec.inspect };
}

/**
 * A rule that cannot be proven, only suspected.
 *
 * Off by default and never an error, by construction rather than by review:
 * there is no parameter here to make it one.
 */
export function defineHeuristic(spec: RuleSpec): Rule {
  return { meta: meta(spec, 'heuristic', 'off'), inspect: spec.inspect };
}

function meta(spec: RuleSpec, confidence: RuleConfidence, defaultSeverity: Severity): RuleMeta {
  return {
    id: spec.id,
    confidence,
    defaultSeverity,
    title: spec.title,
    docs: spec.docs,
    ...(spec.antiPattern === undefined ? {} : { antiPattern: spec.antiPattern }),
    explain: dedent(spec.explain),
  };
}

/** Explanations are written as indented template literals; print them flush. */
function dedent(text: string): string {
  const lines = text.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
  const indent = Math.min(
    ...lines.filter((line) => line.trim()).map((line) => line.length - line.trimStart().length),
  );
  return lines.map((line) => line.slice(indent)).join('\n');
}
