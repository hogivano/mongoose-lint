/** Shared state for one file's parse, and the two things everyone needs from it. */

import type { Node, SourceFile } from 'ts-morph';
import type { SourceLocation, UnresolvedSite } from '../../domain/index.ts';
import { sourceTextOf } from './values.ts';

export interface ReadContext {
  readonly file: SourceFile;
  /** Root-relative path, resolved once per file. */
  readonly path: string;
  /** Schema variables declared in this file, for `[CommentSchema]`. */
  readonly knownSchemas: ReadonlySet<string>;
}

/** A ReadContext narrowed to one schema, for everything the parser does inside one. */
export interface SchemaContext extends ReadContext {
  /** The schema being read, so unresolved sites can name it. */
  readonly schema: string;
}

export function inSchema(context: ReadContext, schema: string): SchemaContext {
  return { ...context, schema };
}

export function locationOf(context: ReadContext, node: Node): SourceLocation {
  const { line, column } = context.file.getLineAndColumnAtPos(node.getStart());
  return { file: context.path, line, column };
}

/**
 * Record something the parser will not guess at.
 *
 * Every call site of this function is a place where a lesser linter would have
 * quietly moved on and reported a clean file.
 */
export function unresolvedAt(
  context: ReadContext | SchemaContext,
  node: Node,
  what: string,
): UnresolvedSite {
  const schema = 'schema' in context ? { schema: context.schema } : {};
  return { location: locationOf(context, node), what, text: sourceTextOf(node), ...schema };
}
