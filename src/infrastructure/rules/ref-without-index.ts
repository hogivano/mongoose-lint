/**
 * Rule 4. A reference path with no index of its own.
 *
 * A correction to the folklore, and to this project's own plan: `populate()`
 * in the forward direction is *not* the expensive case. `post.populate('author')`
 * queries `User.find({ _id: ... })`, and `_id` is always indexed.
 *
 * The cost lands on every query that *filters* by the reference:
 *
 *     Post.find({ author: userId })                 the reverse lookup
 *     Post.find({ author: { $in: [...] } })         the list view
 *     virtual populate, which queries foreignField  on the other schema
 *
 * Those are collection scans without an index on the path — the N+1 that does
 * not look like an N+1, because the populate() call that triggers it is on the
 * other side of the relationship.
 *
 * Off by default. This rule advises *adding* an index, which costs write
 * throughput on every insert, and whether the reverse query happens at all is
 * a fact about the application, not about the schema.
 */

import { defineRule, type RuleMatch } from '../../application/rule.ts';
import type { SchemaModel, SchemaPath } from '../../domain/index.ts';
import { hasRef, indexesLedBy, isIndexed, refOf } from '../../domain/index.ts';
import { DOCS } from './docs.ts';

export const refWithoutIndex = defineRule({
  id: 'ref-without-index',
  defaultSeverity: 'off',
  antiPattern: 'data-normalization',
  title: 'reference path with no index',
  docs: DOCS.singleFieldIndexes,
  explain: `
    A ref path with no index makes every query that filters on it a collection
    scan:

        Post.find({ author: userId })
        User.findById(id).populate('posts')   // virtual populate, foreignField

    Populating in the other direction — post.populate('author') — is not
    affected: that queries _id on the referenced collection, which is indexed.

    The fix is one option:

        author: { type: ObjectId, ref: 'User', index: true }

    Off by default, deliberately. An index costs write throughput on every
    insert and update, and a reference that is only ever read forwards does not
    need one. Turn this rule on for the schemas whose reverse queries you know
    you run.
  `,

  inspect: (schema: SchemaModel): RuleMatch[] =>
    schema.paths.filter((path) => isUnindexedRef(schema, path)).map((path) => ({
      location: path.location,
      subject: path.name,
      message: `"${path.name}" references ${refOf(path)} with no index — queries filtering on it scan the collection`,
      fix: `{ type: ObjectId, ref: '${refOf(path)}', index: true }`,
    })),
});

function isUnindexedRef(schema: SchemaModel, path: SchemaPath): boolean {
  if (!hasRef(path)) return false;
  if (isIndexed(path)) return false;

  // A compound index led by this path serves it too: MongoDB uses a compound
  // index from the left, so { author: 1, createdAt: -1 } covers author alone.
  return indexesLedBy(schema, path.name).length === 0;
}
