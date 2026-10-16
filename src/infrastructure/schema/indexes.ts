/**
 * Every index a schema declares, from both places it can declare one.
 *
 * Rule 2 depends on this being one list rather than two: an index created by
 * `unique: true` on a path is exactly as redundant as the same index written
 * by hand in `schema.index({ email: 1 })`, and a linter that compares only
 * hand-written indexes misses the common half of the problem.
 */

import { Node, SyntaxKind } from 'ts-morph';
import type { CallExpression, ObjectLiteralExpression } from 'ts-morph';
import type { IndexDeclaration, IndexDirection, IndexKey, SchemaPath, Value } from '../../domain/index.ts';
import { isFalse, isTrue } from '../../domain/index.ts';
import { locationOf, type ReadContext } from './context.ts';
import { optionsOf, propertyKey, valueOf } from './values.ts';

/** Path options that carry over onto the index a path declares. */
const INDEX_OPTIONS = [
  'unique',
  'sparse',
  'partialFilterExpression',
  'expires',
  'expireAfterSeconds',
  'collation',
] as const;

/**
 * Indexes created by options on a path: `index: true`, `unique: true`, and
 * `text: true`.
 *
 * An unreadable `index: SOME_FLAG` produces an index here. Assuming it exists
 * can only silence a finding; assuming it does not would invent one.
 */
export function indexesFromPaths(paths: readonly SchemaPath[]): IndexDeclaration[] {
  const indexes: IndexDeclaration[] = [];

  for (const path of paths) {
    const declared = path.options['index'];
    const unique = path.options['unique'];
    const text = path.options['text'];

    const wanted =
      (declared !== undefined && !isFalse(declared)) ||
      (unique !== undefined && !isFalse(unique)) ||
      isTrue(text);
    if (!wanted) continue;

    const options: Record<string, Value> = {};
    for (const option of INDEX_OPTIONS) {
      const value = path.options[option];
      if (value !== undefined && !isFalse(value)) options[option] = value;
    }

    indexes.push({
      keys: [{ path: path.name, direction: isTrue(text) ? 'text' : 1 }],
      options,
      source: 'path-option',
      location: path.location,
      declaredBy: path.name,
    });
  }

  return indexes;
}

/**
 * `schema.index({ tenant: 1, email: 1 }, { unique: true })`.
 *
 * Matched by receiver name so an unrelated `foo.index(...)` in the same file is
 * not mistaken for a schema index — over-matching here would produce redundancy
 * findings about indexes that do not exist.
 */
export function indexesFromCalls(
  context: ReadContext,
  schemaVariable: string | undefined,
): IndexDeclaration[] {
  if (schemaVariable === undefined) return [];

  return context.file
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => isIndexCallOn(call, schemaVariable))
    .flatMap((call) => {
      const [keysArgument, optionsArgument] = call.getArguments();
      if (keysArgument === undefined || !Node.isObjectLiteralExpression(keysArgument)) return [];

      const keys = keysOf(keysArgument);
      if (keys.length === 0) return [];

      return [
        {
          keys,
          options:
            optionsArgument !== undefined && Node.isObjectLiteralExpression(optionsArgument)
              ? optionsOf(optionsArgument)
              : {},
          source: 'schema.index()' as const,
          location: locationOf(context, call),
        },
      ];
    });
}

function isIndexCallOn(call: CallExpression, schemaVariable: string): boolean {
  const callee = call.getExpression();
  return (
    Node.isPropertyAccessExpression(callee) &&
    callee.getName() === 'index' &&
    callee.getExpression().getText() === schemaVariable
  );
}

function keysOf(object: ObjectLiteralExpression): IndexKey[] {
  const keys: IndexKey[] = [];

  for (const property of object.getProperties()) {
    if (!Node.isPropertyAssignment(property)) continue;
    const name = propertyKey(property);
    const initializer = property.getInitializer();
    if (name === undefined || initializer === undefined) continue;
    keys.push({ path: name, direction: directionOf(valueOf(initializer)) });
  }

  return keys;
}

function directionOf(value: Value): IndexDirection {
  if (value.kind !== 'literal') return 'other';
  if (value.value === 1 || value.value === -1) return value.value;
  if (value.value === 'text' || value.value === '2d' || value.value === '2dsphere') {
    return value.value;
  }
  if (value.value === 'hashed') return 'hashed';
  return 'other';
}
