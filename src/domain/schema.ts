/**
 * The resolved schema model: what a Mongoose schema definition looks like once
 * the AST is gone.
 *
 * Everything in this file is plain data. Rules are pure functions over it
 * (see application/rule.ts), which is why a rule test is three lines and why
 * swapping ts-morph for another parser would not touch a single rule.
 *
 * The model is deliberately shallow about types (`kind`) and deliberately
 * literal about options (`Value`). Rules need to know "is this a String path
 * with unique: true", not the full Mongoose type system.
 */

import type { Value } from './value.ts';
import { isFalse, isTrue, stringOf } from './value.ts';

export interface SourceLocation {
  /** Path relative to the scan root — reports must not leak absolute paths. */
  readonly file: string;
  readonly line: number;
  readonly column: number;
}

export function formatLocation(location: SourceLocation): string {
  return `${location.file}:${location.line}:${location.column}`;
}

/**
 * What a path holds. `unknown` is a real answer: a path whose type is a
 * variable or a call is still a path, and its options are still worth linting.
 */
export type PathKind =
  | 'String'
  | 'Number'
  | 'Boolean'
  | 'Date'
  | 'ObjectId'
  | 'Buffer'
  | 'Decimal128'
  | 'UUID'
  | 'BigInt'
  | 'Map'
  | 'Mixed'
  | 'Array'
  | 'Subdocument'
  | 'unknown';

/** The element type of an array path — the part that decides rule 5. */
export interface ArrayElement {
  readonly kind: PathKind;
  /** `[CommentSchema]` or `[{ body: String }]`, as opposed to `[String]`. */
  readonly isSubdocument: boolean;
  /** Set when the elements are references: `[{ type: ObjectId, ref: 'Tag' }]`. */
  readonly ref?: string;
}

/** Raw options as written, keyed by option name. Absent means not written. */
export type PathOptions = Readonly<Record<string, Value>>;

export interface SchemaPath {
  /** Dotted for nested definitions: `profile.email`. */
  readonly name: string;
  readonly kind: PathKind;
  /** Only present when `kind` is `Array`. */
  readonly element?: ArrayElement;
  readonly options: PathOptions;
  readonly location: SourceLocation;
}

export type IndexDirection = 1 | -1 | 'text' | '2d' | '2dsphere' | 'hashed' | 'other';

export interface IndexKey {
  readonly path: string;
  readonly direction: IndexDirection;
}

/**
 * Where an index came from. Both forms produce a real index, and rule 2 has to
 * compare across them: `{ email: 1 }` from `unique: true` on a path is exactly
 * as redundant as the same index declared by hand.
 */
export type IndexSource = 'path-option' | 'schema.index()';

export interface IndexDeclaration {
  readonly keys: readonly IndexKey[];
  readonly options: Readonly<Record<string, Value>>;
  readonly source: IndexSource;
  readonly location: SourceLocation;
  /** For path-option indexes: the path that declared it. */
  readonly declaredBy?: string;
}

/** Something the parser met and refused to guess at. Always reported. */
export interface UnresolvedSite {
  readonly location: SourceLocation;
  /** What could not be resolved: "spread in schema definition". */
  readonly what: string;
  /** The source as written, one line, trimmed. */
  readonly text: string;
  /** The schema it was found in, when it was found inside one. */
  readonly schema?: string;
}

export interface SchemaModel {
  /** The variable it was assigned to, or `<anonymous>`. Used in reports. */
  readonly name: string;
  readonly location: SourceLocation;
  readonly paths: readonly SchemaPath[];
  readonly indexes: readonly IndexDeclaration[];
  /** The second argument to `new Schema(definition, options)`. */
  readonly options: Readonly<Record<string, Value>>;
  /**
   * Parts of this schema the parser could not read. A rule that reasons about
   * the *absence* of something (rule 2: "no other index covers this") must
   * check this first — see `isFullyResolved`.
   */
  readonly unresolved: readonly UnresolvedSite[];
}

/**
 * True when nothing in this schema defeated the parser.
 *
 * Rules that argue from absence are only sound on a fully resolved schema.
 * "There is no compound index covering this path" is not a fact about a schema
 * with a spread in it — it is a fact about the half we could read.
 */
export function isFullyResolved(schema: SchemaModel): boolean {
  return schema.unresolved.length === 0;
}

/** Every index whose first key is this path — the ones that serve it. */
export function indexesLedBy(schema: SchemaModel, pathName: string): IndexDeclaration[] {
  return schema.indexes.filter((index) => index.keys[0]?.path === pathName);
}

export function formatIndexKeys(index: IndexDeclaration): string {
  return `{ ${index.keys.map((key) => `${key.path}: ${format(key.direction)}`).join(', ')} }`;
}

function format(direction: IndexDirection): string {
  return typeof direction === 'number' ? String(direction) : `'${direction}'`;
}

/**
 * True when `candidate`'s keys are a leading run of `longer`'s keys.
 *
 * Order is the whole point: `{a:1}` is a prefix of `{a:1,b:1}`, but `{b:1}` is
 * not a prefix of `{b:1,a:1}`'s sibling `{a:1,b:1}` — MongoDB can only use a
 * compound index from the left (the adversarial fixture).
 *
 * Direction is ignored for a single-key candidate, because a one-field index
 * is traversable in both directions, and compared for anything longer, where
 * the sort order stops being interchangeable.
 */
export function isIndexPrefixOf(candidate: IndexDeclaration, longer: IndexDeclaration): boolean {
  if (candidate.keys.length >= longer.keys.length) return false;

  return candidate.keys.every((key, position) => {
    const other = longer.keys[position];
    if (other === undefined || other.path !== key.path) return false;
    return candidate.keys.length === 1 || other.direction === key.direction;
  });
}

/** Options that make an index do something a wider index would not do. */
const CONSTRAINING_OPTIONS = [
  'unique',
  'partialFilterExpression',
  'sparse',
  'expireAfterSeconds',
  'collation',
  'weights',
  'wildcardProjection',
] as const;

/**
 * True when an index carries a constraint or behaviour of its own, so dropping
 * it in favour of a wider index would change what the database enforces.
 *
 * This is the guard that keeps rule 2 honest. A unique index on `{email: 1}`
 * is *not* made redundant by `{email: 1, tenant: 1}`: the compound one permits
 * the same email twice under different tenants.
 */
export function isConstrained(index: IndexDeclaration): boolean {
  return CONSTRAINING_OPTIONS.some((option) => option in index.options);
}

/** True when any key uses a special index type, where prefix logic does not apply. */
export function usesSpecialIndexType(index: IndexDeclaration): boolean {
  return index.keys.some((key) => typeof key.direction !== 'number');
}

// ── Path option predicates ────────────────────────────────────────────────
// Named questions rather than string lookups at each call site, so the answer
// to "what counts as required?" lives in one place.

export function isUnique(path: SchemaPath): boolean {
  return isTrue(path.options['unique']);
}

export function isRequired(path: SchemaPath): boolean {
  return isTrue(path.options['required']);
}

/**
 * `required: someFunction` or `required: [isAdmin, 'msg']` — required only
 * sometimes, which for a unique index means missing sometimes.
 */
export function hasConditionalRequired(path: SchemaPath): boolean {
  const required = path.options['required'];
  return required !== undefined && !isTrue(required) && !isFalse(required);
}

/**
 * True when the path declares an index of its own.
 *
 * An unreadable `index: SOME_FLAG` counts as indexed. The asymmetry is
 * deliberate: treating it as absent would invent a finding, treating it as
 * present only loses one.
 */
export function isIndexed(path: SchemaPath): boolean {
  const index = path.options['index'];
  return isUnique(path) || (index !== undefined && !isFalse(index));
}

export function isSparse(path: SchemaPath): boolean {
  return isTrue(path.options['sparse']);
}

export function isLowercased(path: SchemaPath): boolean {
  return isTrue(path.options['lowercase']);
}

/** The model name a path references, from `ref` or `refPath`. */
export function refOf(path: SchemaPath): string | undefined {
  const direct = stringOf(path.options['ref']) ?? stringOf(path.options['refPath']);
  if (direct !== undefined) return direct;
  if ('ref' in path.options || 'refPath' in path.options) return '<dynamic>';
  return path.element?.ref;
}

export function hasRef(path: SchemaPath): boolean {
  return refOf(path) !== undefined;
}
