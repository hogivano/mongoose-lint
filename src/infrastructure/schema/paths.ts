/**
 * The definition object of a schema → `SchemaPath[]`.
 *
 * Mongoose accepts the same path written several ways:
 *
 *   email: String                       a bare type
 *   email: { type: String, ... }        a type with options
 *   profile: { city: String }           a nested group, not a type
 *   tags: [String]                      an array of primitives
 *   comments: [{ body: String }]        an array of subdocuments
 *   author: { type: ObjectId, ref: 'User' }
 *
 * Telling a nested group from a type declaration is the one genuinely
 * ambiguous case, and it is resolved the way Mongoose itself resolves it: an
 * object with a `type` key is a type declaration. A schema with a literal field
 * called `type` needs Mongoose's own `typeKey` option, and that is noted where
 * it bites rather than guessed at here.
 */

import { Node } from 'ts-morph';
import type { ArrayLiteralExpression, ObjectLiteralExpression, PropertyAssignment } from 'ts-morph';
import type { ArrayElement, SchemaPath, UnresolvedSite, Value } from '../../domain/index.ts';
import { locationOf, unresolvedAt, type SchemaContext } from './context.ts';
import { looksLikeSchemaIdentifier, resolveType } from './types.ts';
import { hasHiddenKeys, optionsOf, propertyKey } from './values.ts';

export interface PathsRead {
  readonly paths: SchemaPath[];
  readonly unresolved: UnresolvedSite[];
}

export function readPaths(definition: ObjectLiteralExpression, context: SchemaContext): PathsRead {
  const result: PathsRead = { paths: [], unresolved: [] };
  walk(definition, '', context, result);
  return result;
}

function walk(
  object: ObjectLiteralExpression,
  prefix: string,
  context: SchemaContext,
  out: PathsRead,
): void {
  for (const property of object.getProperties()) {
    if (Node.isSpreadAssignment(property)) {
      out.unresolved.push(
        unresolvedAt(context, property, 'spread in a schema definition'),
      );
      continue;
    }
    if (Node.isShorthandPropertyAssignment(property)) {
      out.unresolved.push(
        unresolvedAt(context, property, 'shorthand property in a schema definition'),
      );
      continue;
    }
    if (!Node.isPropertyAssignment(property)) {
      out.unresolved.push(
        unresolvedAt(context, property, 'non-property member in a schema definition'),
      );
      continue;
    }

    const key = propertyKey(property);
    if (key === undefined) {
      out.unresolved.push(unresolvedAt(context, property, 'computed path name'));
      continue;
    }

    readPath(`${prefix}${key}`, property, context, out);
  }
}

function readPath(
  name: string,
  property: PropertyAssignment,
  context: SchemaContext,
  out: PathsRead,
): void {
  const initializer = property.getInitializer();
  if (initializer === undefined) {
    out.unresolved.push(unresolvedAt(context, property, 'path with no definition'));
    return;
  }

  const location = locationOf(context, property);

  if (Node.isArrayLiteralExpression(initializer)) {
    const shape = arrayOf(name, initializer, context, out);
    out.paths.push({ name, kind: 'Array', element: shape.element, options: shape.options, location });
    return;
  }

  if (Node.isObjectLiteralExpression(initializer)) {
    if (hasHiddenKeys(initializer)) {
      out.unresolved.push(
        unresolvedAt(context, initializer, `options of path "${name}" are partly hidden`),
      );
    }

    const typeNode = typeNodeOf(initializer);

    // No `type` key: a nested group of paths, addressed as `profile.city`.
    if (typeNode === undefined) {
      if (initializer.getProperties().length === 0) {
        out.paths.push({ name, kind: 'Mixed', options: {}, location });
        return;
      }
      walk(initializer, `${name}.`, context, out);
      return;
    }

    const options = optionsOf(initializer);
    delete options['type'];

    // `tags: { type: [String], required: true }` — options on both levels, and
    // the outer ones win, as they do in Mongoose.
    if (Node.isArrayLiteralExpression(typeNode)) {
      const shape = arrayOf(name, typeNode, context, out);
      out.paths.push({
        name,
        kind: 'Array',
        element: shape.element,
        options: { ...shape.options, ...options },
        location,
      });
      return;
    }

    out.paths.push({
      name,
      kind: resolveType(typeNode, context.knownSchemas).kind,
      options,
      location,
    });
    return;
  }

  // A bare type: `email: String`.
  const resolved = resolveType(initializer, context.knownSchemas);
  if (resolved.recognised) {
    out.paths.push({ name, kind: resolved.kind, options: {}, location });
    return;
  }

  // Anything else — a variable, a call, a factory. Its options are unknowable,
  // and an unknown option set is exactly what this tool must not guess at.
  out.unresolved.push(
    unresolvedAt(context, property, `path "${name}" is not a literal definition`),
  );
}

/** The `type:` node of a type declaration, or undefined for a nested group. */
function typeNodeOf(object: ObjectLiteralExpression): Node | undefined {
  const property = object.getProperty('type');
  return property !== undefined && Node.isPropertyAssignment(property)
    ? property.getInitializer()
    : undefined;
}

/**
 * `[String]`, `[CommentSchema]`, `[{ type: ObjectId, ref: 'Tag' }]`, `[{ body: String }]`.
 *
 * Options written on an element object belong to the path in Mongoose, so they
 * are lifted: `tags: [{ type: String, index: true }]` is an indexed path.
 * Inline subdocuments are descended into, because Mongoose indexes them under
 * the dotted name — `comments.email` is a real index path.
 */
function arrayOf(
  name: string,
  array: ArrayLiteralExpression,
  context: SchemaContext,
  out: PathsRead,
): { element: ArrayElement; options: Record<string, Value> } {
  const [first] = array.getElements();

  if (first === undefined) {
    return { element: { kind: 'Mixed', isSubdocument: false }, options: {} };
  }

  if (Node.isObjectLiteralExpression(first)) {
    const typeNode = typeNodeOf(first);

    if (typeNode === undefined) {
      // `[{ body: String }]` — an inline subdocument schema.
      walk(first, `${name}.`, context, out);
      return { element: { kind: 'Subdocument', isSubdocument: true }, options: {} };
    }

    const options = optionsOf(first);
    delete options['type'];
    const ref = options['ref'];
    const kind = resolveType(typeNode, context.knownSchemas).kind;

    return {
      element: {
        kind,
        isSubdocument: kind === 'Subdocument',
        ...(ref?.kind === 'literal' && typeof ref.value === 'string' ? { ref: ref.value } : {}),
      },
      options,
    };
  }

  const resolved = resolveType(first, context.knownSchemas);
  if (resolved.recognised) {
    return {
      element: { kind: resolved.kind, isSubdocument: resolved.kind === 'Subdocument' },
      options: {},
    };
  }

  if (Node.isArrayLiteralExpression(first)) {
    return { element: { kind: 'Array', isSubdocument: false }, options: {} };
  }

  // `[CommentSchema]` where CommentSchema is imported. The naming convention is
  // the only evidence available, so it is recorded as such — and only the
  // heuristic rule, which is off by default, is allowed to act on it.
  if (looksLikeSchemaIdentifier(first)) {
    return { element: { kind: 'Subdocument', isSubdocument: true }, options: {} };
  }

  out.unresolved.push(
    unresolvedAt(context, first, `element type of array "${name}" is not a literal`),
  );
  return { element: { kind: 'unknown', isSubdocument: false }, options: {} };
}

