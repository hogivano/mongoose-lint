/**
 * Rule 2. Deterministic, and safe to ship as an error for a reason worth
 * stating: this rule advises *dropping* an index.
 *
 * Advice to add an index can be wrong in a way that costs write throughput and
 * disk. Advice to drop an index that a compound index already serves as a
 * prefix costs nothing if taken and nothing if ignored, which is a much better
 * position for a linter with no brand behind it.
 *
 * Enforces MongoDB's Unnecessary Indexes anti-pattern.
 */

import { defineRule, type RuleMatch } from '../../application/rule.ts';
import type { IndexDeclaration, SchemaModel } from '../../domain/index.ts';
import {
  formatIndexKeys,
  isConstrained,
  isFullyResolved,
  isIndexPrefixOf,
  usesSpecialIndexType,
} from '../../domain/index.ts';
import { DOCS } from './docs.ts';

export const redundantIndexPrefix = defineRule({
  id: 'redundant-index-prefix',
  defaultSeverity: 'error',
  antiPattern: 'unnecessary-indexes',
  title: 'index is already served as a prefix of a compound index',
  docs: DOCS.compoundIndexes,
  explain: `
    MongoDB can use a compound index for queries on any leading subset of its
    keys, so { a: 1 } declared alongside { a: 1, b: 1 } is served twice. The
    narrower index costs write throughput and RAM and buys nothing.

    Order is what makes it a prefix: { b: 1 } is not covered by { a: 1, b: 1 },
    because the compound index can only be entered from the left.

    An index that enforces something of its own — unique, a partial filter,
    sparse, a TTL, a collation — is never reported here, whatever else covers
    it. A unique index on { email: 1 } and a compound { email: 1, tenant: 1 }
    enforce different constraints.
  `,

  inspect: (schema: SchemaModel): RuleMatch[] => {
    // Arguing from absence — "nothing else needs this index" — is only sound
    // when the whole schema was readable.
    if (!isFullyResolved(schema)) return [];

    const candidates = schema.indexes.filter(
      (index) => !isConstrained(index) && !usesSpecialIndexType(index),
    );

    return candidates.flatMap((index) => {
      const covering = schema.indexes.find(
        (other) => !usesSpecialIndexType(other) && isIndexPrefixOf(index, other),
      );
      return covering === undefined ? [] : [match(index, covering)];
    });
  },
});

function match(index: IndexDeclaration, covering: IndexDeclaration): RuleMatch {
  const keys = formatIndexKeys(index);
  const declaredHere =
    index.source === 'path-option'
      ? `index: true on "${index.declaredBy}"`
      : `schema.index(${keys})`;

  return {
    location: index.location,
    subject: keys,
    message: `${declaredHere} is redundant — ${formatIndexKeys(covering)} already serves it as a prefix`,
    fix:
      index.source === 'path-option'
        ? `remove index: true from "${index.declaredBy}"`
        : `remove schema.index(${keys})`,
  };
}
