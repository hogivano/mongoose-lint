/**
 * Rule 3. Enforces MongoDB's Case Sensitivity anti-pattern.
 *
 * A unique index compares strings byte for byte by default, so
 * `Bob@example.com` and `bob@example.com` both register. It surfaces months
 * later as "duplicate accounts" and a support ticket, not as an error.
 *
 * Deterministic, but off by default: some string fields are meant to be case
 * sensitive — a slug, a token, an external id — and only the team knows which.
 */

import { defineRule, type RuleMatch } from '../../application/rule.ts';
import type { Literal, SchemaModel, SchemaPath, Value } from '../../domain/index.ts';
import { indexesLedBy, isLowercased, isUnique, objectOf } from '../../domain/index.ts';
import { DOCS } from './docs.ts';

export const caseInsensitiveUnique = defineRule({
  id: 'case-insensitive-unique',
  defaultSeverity: 'off',
  antiPattern: 'case-sensitivity',
  title: 'unique String path with no case-insensitive collation',
  docs: DOCS.collation,
  explain: `
    A unique index on a String path is case sensitive unless told otherwise, so
    Bob@example.com and bob@example.com are two different accounts.

    Two fixes, and they are not equivalent:

        { type: String, unique: true, lowercase: true }

    normalises on write — simple, and it changes the stored value.

        new Schema({...}, { collation: { locale: 'en', strength: 2 } })

    compares case-insensitively at the index level and stores what the user
    typed. Strength 2 ignores case; strength 1 also ignores diacritics.

    Off by default: a slug, an API key or an external id is meant to be case
    sensitive, and only you know which of your unique strings are which.
  `,

  inspect: (schema: SchemaModel): RuleMatch[] => {
    // A collation on the schema covers every index in it.
    if (isCaseInsensitive(schema.options['collation']) !== 'no') return [];

    return schema.paths.filter((path) => isAtRisk(schema, path)).map((path) => ({
      location: path.location,
      subject: path.name,
      message: `unique "${path.name}" compares case sensitively — "A@x.com" and "a@x.com" both register`,
      fix: `{ type: String, unique: true, lowercase: true }`,
    }));
  },
});

function isAtRisk(schema: SchemaModel, path: SchemaPath): boolean {
  if (path.kind !== 'String') return false;
  if (!isUnique(path)) return false;
  if (isLowercased(path)) return false;

  return indexesLedBy(schema, path.name).every(
    (index) => isCaseInsensitive(index.options['collation']) === 'no',
  );
}

/**
 * Whether a collation ignores case.
 *
 * `unknown` when a collation is declared but its strength is not readable —
 * treated as case-insensitive by the caller, because a declared collation is
 * evidence that someone thought about this, and inventing a finding over it
 * would be exactly the kind of noise that gets a rule turned off.
 */
function isCaseInsensitive(collation: Value | undefined): 'yes' | 'no' | 'unknown' {
  if (collation === undefined) return 'no';

  const object = objectOf(collation);
  if (object === undefined) return 'unknown';

  const strength = strengthOf(object['strength']);
  if (strength === undefined) return 'unknown';
  return strength <= 2 ? 'yes' : 'no';
}

function strengthOf(value: Literal | undefined): number | undefined {
  return typeof value === 'number' ? value : undefined;
}
