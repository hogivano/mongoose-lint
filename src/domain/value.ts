/**
 * A value read out of a schema literal — or an honest admission that it could
 * not be read.
 *
 * This type is the whole discipline of the tool in miniature: a
 * static parser meets `unique: FLAGS.unique` sooner or later, and the only
 * acceptable answer is `unresolved`, never a guess. Rules ask questions like
 * `isTrue(options.unique)`, which is false for both "absent" and "unknown" —
 * so an unreadable option can never manufacture a finding.
 */

export type Literal =
  | string
  | number
  | boolean
  | null
  | readonly Literal[]
  | { readonly [key: string]: Literal };

export type Value =
  | { readonly kind: 'literal'; readonly value: Literal }
  | { readonly kind: 'unresolved'; readonly text: string };

export function literal(value: Literal): Value {
  return { kind: 'literal', value };
}

/** `text` is the source as written, so a report can quote what defeated it. */
export function unresolved(text: string): Value {
  return { kind: 'unresolved', text };
}

export function isUnresolved(value: Value | undefined): boolean {
  return value?.kind === 'unresolved';
}

/** Present, readable, and exactly `true`. The question most rules ask. */
export function isTrue(value: Value | undefined): boolean {
  return value?.kind === 'literal' && value.value === true;
}

export function isFalse(value: Value | undefined): boolean {
  return value?.kind === 'literal' && value.value === false;
}

export function stringOf(value: Value | undefined): string | undefined {
  return value?.kind === 'literal' && typeof value.value === 'string' ? value.value : undefined;
}

export function objectOf(value: Value | undefined): Record<string, Literal> | undefined {
  return value?.kind === 'literal' && isPlainObject(value.value) ? value.value : undefined;
}

function isPlainObject(value: Literal): value is Record<string, Literal> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
