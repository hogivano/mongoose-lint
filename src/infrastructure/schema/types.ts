/**
 * Recognising Mongoose's type declarations.
 *
 * `String`, `'String'`, `Schema.Types.ObjectId`, `mongoose.Types.ObjectId` and
 * a bare `Types.ObjectId` are all the same declaration written five ways, and
 * a rule that only understands one of them is a rule that silently passes four
 * out of five codebases.
 *
 * Anything not on this list resolves to `unknown` — a real answer, not a
 * failure. An unknown type still has readable options, and `unique: true` on
 * an optional path is a finding whatever the path holds.
 */

import { Node } from 'ts-morph';
import type { PathKind } from '../../domain/index.ts';

/** `String` → 'String'. The plain constructors and their string aliases. */
const BY_NAME: Readonly<Record<string, PathKind>> = {
  String: 'String',
  Number: 'Number',
  Boolean: 'Boolean',
  Date: 'Date',
  Buffer: 'Buffer',
  Map: 'Map',
  BigInt: 'BigInt',
  ObjectId: 'ObjectId',
  Oid: 'ObjectId',
  Decimal128: 'Decimal128',
  UUID: 'UUID',
  Mixed: 'Mixed',
  Object: 'Mixed',
};

/** The trailing name of a qualified type: `Schema.Types.ObjectId` → ObjectId. */
function tailName(node: Node): string | undefined {
  if (Node.isIdentifier(node)) return node.getText();
  if (Node.isPropertyAccessExpression(node)) return node.getName();
  return undefined;
}

export interface TypeResolution {
  readonly kind: PathKind;
  /** True when we recognised the node as a type declaration at all. */
  readonly recognised: boolean;
}

const UNRECOGNISED: TypeResolution = { kind: 'unknown', recognised: false };

/**
 * Resolve a type declaration node.
 *
 * `knownSchemas` are the schema variables declared in the same file, so
 * `comments: [CommentSchema]` can be told from `comments: [someArray]`.
 */
export function resolveType(node: Node, knownSchemas: ReadonlySet<string>): TypeResolution {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    const kind = BY_NAME[node.getLiteralValue()];
    return kind === undefined ? UNRECOGNISED : { kind, recognised: true };
  }

  if (Node.isIdentifier(node) && knownSchemas.has(node.getText())) {
    return { kind: 'Subdocument', recognised: true };
  }

  const name = tailName(node);
  if (name === undefined) return UNRECOGNISED;

  const kind = BY_NAME[name];
  if (kind !== undefined) return { kind, recognised: true };

  // A `new Schema({...})` written inline as the type of a path.
  if (Node.isNewExpression(node)) return { kind: 'Subdocument', recognised: true };

  return UNRECOGNISED;
}

/**
 * Whether an identifier looks like a schema imported from another file.
 *
 * Purely a naming convention, and used by exactly one place: the unbounded
 * array heuristic, which is off by default and only ever a warning. No
 * deterministic rule is allowed to depend on this.
 */
export function looksLikeSchemaIdentifier(node: Node): boolean {
  const name = tailName(node);
  return name !== undefined && /Schema$/.test(name);
}
