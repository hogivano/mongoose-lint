/**
 * AST node → `Value`.
 *
 * The rule for this file, and it has no exceptions: anything that is not a
 * literal written in place comes back `unresolved`, carrying its source text.
 * `unique: FLAGS.uniqueEmail` is not `unique: true`, and it is not `unique:
 * false` either — it is unknown, and the report says so.
 */

import { Node, SyntaxKind } from 'ts-morph';
import type { ObjectLiteralExpression, PropertyAssignment } from 'ts-morph';
import type { Literal, Value } from '../../domain/index.ts';
import { literal, unresolved } from '../../domain/index.ts';

const TEXT_MAX = 60;

export function valueOf(node: Node): Value {
  const asLiteral = literalOf(node);
  return asLiteral === NOT_LITERAL ? unresolved(sourceTextOf(node)) : literal(asLiteral);
}

/** Sentinel, so `null` and `false` stay distinguishable from "not a literal". */
const NOT_LITERAL = Symbol('not-literal');

function literalOf(node: Node): Literal | typeof NOT_LITERAL {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralValue();
  }
  if (Node.isNumericLiteral(node)) return node.getLiteralValue();
  if (node.isKind(SyntaxKind.TrueKeyword)) return true;
  if (node.isKind(SyntaxKind.FalseKeyword)) return false;
  if (Node.isNullLiteral(node)) return null;

  // `-1`, which is half of every index declaration ever written.
  if (Node.isPrefixUnaryExpression(node) && node.getOperatorToken() === SyntaxKind.MinusToken) {
    const operand = literalOf(node.getOperand());
    return typeof operand === 'number' ? -operand : NOT_LITERAL;
  }

  if (Node.isArrayLiteralExpression(node)) {
    const elements: Literal[] = [];
    for (const element of node.getElements()) {
      const value = literalOf(element);
      if (value === NOT_LITERAL) return NOT_LITERAL;
      elements.push(value);
    }
    return elements;
  }

  if (Node.isObjectLiteralExpression(node)) {
    const object: Record<string, Literal> = {};
    for (const property of node.getProperties()) {
      // A spread makes the whole object unknowable: the keys it contributes
      // could include the very option being asked about.
      if (!Node.isPropertyAssignment(property)) return NOT_LITERAL;
      const initializer = property.getInitializer();
      if (initializer === undefined) return NOT_LITERAL;
      const name = propertyKey(property);
      if (name === undefined) return NOT_LITERAL;
      const value = literalOf(initializer);
      if (value === NOT_LITERAL) return NOT_LITERAL;
      object[name] = value;
    }
    return object;
  }

  return NOT_LITERAL;
}

/** The key of a property assignment, or undefined when it is computed. */
export function propertyKey(property: PropertyAssignment): string | undefined {
  const name = property.getNameNode();
  if (Node.isIdentifier(name)) return name.getText();
  if (Node.isStringLiteral(name) || Node.isNoSubstitutionTemplateLiteral(name)) {
    return name.getLiteralValue();
  }
  if (Node.isNumericLiteral(name)) return String(name.getLiteralValue());
  return undefined;
}

/** Every readable `key: value` pair of an object literal, as `Value`s. */
export function optionsOf(object: ObjectLiteralExpression): Record<string, Value> {
  const options: Record<string, Value> = {};
  for (const property of object.getProperties()) {
    if (!Node.isPropertyAssignment(property)) continue;
    const name = propertyKey(property);
    const initializer = property.getInitializer();
    if (name === undefined || initializer === undefined) continue;
    options[name] = valueOf(initializer);
  }
  return options;
}

/** True when an object literal contains something that hides keys from us. */
export function hasHiddenKeys(object: ObjectLiteralExpression): boolean {
  return object
    .getProperties()
    .some(
      (property) =>
        Node.isSpreadAssignment(property) ||
        Node.isShorthandPropertyAssignment(property) ||
        (Node.isPropertyAssignment(property) && propertyKey(property) === undefined),
    );
}

/** One line, trimmed and capped — source text is for quoting, not for reading. */
export function sourceTextOf(node: Node): string {
  const text = node.getText().replace(/\s+/g, ' ').trim();
  return text.length > TEXT_MAX ? `${text.slice(0, TEXT_MAX - 1)}…` : text;
}
