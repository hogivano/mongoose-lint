/**
 * The subtlety most write-ups get wrong.
 *
 * `partialFilterExpression: { email: { $exists: true } }` looks like the fix
 * for rule 1, and it is — right up until the application writes a literal
 * `null`. An explicit null satisfies `$exists: true`, so the document *is*
 * indexed, and the second one collides exactly as before.
 *
 * Whether the application ever writes a literal null is not visible in a
 * schema, so this is a warning, off by default, and phrased as a question
 * rather than a verdict. It is separate from rule 1 on purpose: someone who
 * knows their writes never produce nulls can leave rule 1 on as an error and
 * this one off, instead of turning both off together.
 */

import { defineRule, type RuleMatch } from '../../application/rule.ts';
import type { Literal, SchemaModel, SchemaPath } from '../../domain/index.ts';
import { isUnique, objectOf } from '../../domain/index.ts';
import { DOCS } from './docs.ts';
import { pathKey } from './format.ts';

export const uniquePartialFilterExists = defineRule({
  id: 'unique-partial-filter-exists',
  defaultSeverity: 'off',
  title: 'partial unique index filtered on $exists rather than $type',
  docs: DOCS.partialIndexes,
  explain: `
    { $exists: true } is true for a field explicitly set to null, so a partial
    unique index built on it still indexes those documents — and the second one
    collides:

        { unique: true, partialFilterExpression: { email: { $exists: true } } }
        db.users.insertOne({ email: null })   // indexed
        db.users.insertOne({ email: null })   // E11000

    { $type: 'string' } excludes them, because null is not a string:

        { unique: true, partialFilterExpression: { email: { $type: 'string' } } }

    Off by default: if your application never writes an explicit null for the
    field, $exists is a correct fix and this rule has nothing to tell you.
  `,

  inspect: (schema: SchemaModel): RuleMatch[] =>
    schema.paths.filter(usesExistsFilter).map((path) => ({
      location: path.location,
      subject: path.name,
      message: `partial index on "${path.name}" filters on $exists, which still indexes an explicit null`,
      fix: `partialFilterExpression: { ${pathKey(path.name)}: { $type: 'string' } }`,
    })),
});

function usesExistsFilter(path: SchemaPath): boolean {
  if (!isUnique(path)) return false;

  const filter = objectOf(path.options['partialFilterExpression']);
  if (filter === undefined) return false;

  return Object.values(filter).some(mentionsExists);
}

function mentionsExists(condition: Literal): boolean {
  return typeof condition === 'object' && condition !== null && !Array.isArray(condition)
    ? '$exists' in condition
    : false;
}
