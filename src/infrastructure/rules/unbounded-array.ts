/**
 * Rule 5. The heuristic one, and the only rule here that can be wrong about a
 * schema it reads correctly.
 *
 * MongoDB's Unbounded Arrays anti-pattern: an array that grows without limit
 * eventually meets the 16MB document ceiling, and long before that it makes
 * every read of the parent document more expensive than it needs to be.
 *
 * You cannot statically prove an array is unbounded. So the heuristic is
 * narrowed until what is left is defensible:
 *
 *   - only arrays of subdocuments or references, never arrays of primitives
 *     (`tags: [String]` is almost always fine)
 *   - never when the schema declares a cap: a validator, a max, a capped option
 *   - a warning, off by default, and phrased with its reasoning attached
 *
 * If this rule is noisy on a real codebase, the answer is to cut it, not to
 * tune it. One rule that cries wolf and the whole tool gets disabled.
 */

import { defineHeuristic, type RuleMatch } from '../../application/rule.ts';
import type { SchemaModel, SchemaPath } from '../../domain/index.ts';
import { DOCS } from './docs.ts';

/** Options that say someone has already thought about how big this gets. */
const CAP_OPTIONS = ['validate', 'validator', 'max', 'maxlength', 'maxLength', 'capped'] as const;

export const unboundedArray = defineHeuristic({
  id: 'unbounded-array',
  antiPattern: 'unbounded-arrays',
  title: 'array of subdocuments with no declared bound',
  docs: DOCS.antiPatterns,
  explain: `
    An array of subdocuments or references that grows with usage runs into the
    16MB document limit, and makes every read of the parent document heavier
    long before it gets there.

    Three ways out, in the order they are usually right:

      extract      move the items to their own collection with a reference
                   back — the answer for comments, events, audit entries
      subset       keep the most recent few in the document, the rest in
                   another collection, when reads want only the recent ones
      bucketing    group items into fixed-size documents, for time series

    Or declare the bound, if there is one, and this rule will stop asking:

        { type: [ItemSchema], validate: (items) => items.length <= 50 }

    This rule is a heuristic and it knows it: it cannot tell a comments array
    from a two-element address array. It is off by default, it is never an
    error, and if it is noisy on your schemas you should turn it off rather
    than argue with it.
  `,

  inspect: (schema: SchemaModel): RuleMatch[] =>
    schema.paths.filter(isUnbounded).map((path) => ({
      location: path.location,
      subject: path.name,
      message: `"${path.name}" is an array of ${describe(path)} with no declared bound`,
      fix: `move ${path.name} to its own collection, or declare a cap: validate: (items) => items.length <= N`,
      note: 'heuristic — no static check can prove an array is unbounded',
    })),
});

function isUnbounded(path: SchemaPath): boolean {
  if (path.kind !== 'Array' || path.element === undefined) return false;

  const holdsDocuments = path.element.isSubdocument || path.element.ref !== undefined;
  if (!holdsDocuments) return false;

  return !CAP_OPTIONS.some((option) => option in path.options);
}

function describe(path: SchemaPath): string {
  return path.element?.ref !== undefined ? `references to ${path.element.ref}` : 'subdocuments';
}
