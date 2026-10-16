/**
 * Rule 1. The one this tool exists for.
 *
 * `unique: true` without `required: true` is a bug with a delay fuse. Missing
 * fields are indexed as `null`, so the *second* document without the field
 * collides with the first and throws E11000 — months after launch, and never
 * in development, where there is only ever one such document.
 *
 * Deterministic, and an error by default: nothing about the finding depends on
 * how the application happens to use the schema.
 */

import { defineRule, type RuleMatch } from '../../application/rule.ts';
import type { SchemaModel, SchemaPath } from '../../domain/index.ts';
import { hasConditionalRequired, isRequired, isSparse, isUnique } from '../../domain/index.ts';
import { DOCS } from './docs.ts';
import { pathKey } from './format.ts';

export const uniqueOnOptionalField = defineRule({
  id: 'unique-on-optional-field',
  defaultSeverity: 'error',
  title: 'unique: true on an optional field',
  docs: DOCS.partialIndexes,
  explain: `
    A unique index treats a missing field as null. The first document without
    the field indexes null, and the second one collides with it:

        E11000 duplicate key error ... { email: null }

    It never happens in development, where only one such document exists.

    The fix is a partial index, so documents without the field are not indexed
    at all:

        { unique: true, partialFilterExpression: { email: { $type: 'string' } } }

    Use $type rather than $exists if the application ever writes a literal
    null — an explicit null satisfies $exists: true and still collides.

    sparse: true is the legacy equivalent and still works. Partial indexes are
    the modern recommendation and express the intent more precisely.

    The other fix is required: true, when the field genuinely is mandatory.
  `,

  inspect: (schema: SchemaModel): RuleMatch[] =>
    schema.paths.filter(isAtRisk).map((path) => ({
      location: path.location,
      subject: path.name,
      message: `"${path.name}" is unique but not required — the second document without it throws E11000`,
      fix: `{ unique: true, partialFilterExpression: { ${pathKey(path.name)}: { $type: '${bsonType(path)}' } } }`,
      ...(hasConditionalRequired(path)
        ? {
            note: 'required is conditional here, so the field can still be absent',
          }
        : {}),
    })),
});

function isAtRisk(path: SchemaPath): boolean {
  if (!isUnique(path)) return false;
  if (isRequired(path)) return false;

  // Already mitigated: a partial index or a sparse index excludes the
  // documents that would otherwise collide on null.
  if (isSparse(path)) return false;
  if ('partialFilterExpression' in path.options) return false;

  return true;
}

/** The $type the fix should filter on, so the suggestion is copy-pasteable. */
function bsonType(path: SchemaPath): string {
  switch (path.kind) {
    case 'String':
      return 'string';
    case 'Number':
      return 'number';
    case 'ObjectId':
      return 'objectId';
    case 'Date':
      return 'date';
    case 'Boolean':
      return 'bool';
    default:
      return 'string';
  }
}
