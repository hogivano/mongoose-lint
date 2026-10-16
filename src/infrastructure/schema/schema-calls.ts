/**
 * Finding `new Schema(...)` — including all the ways it is spelled.
 *
 *   import mongoose from 'mongoose';        new mongoose.Schema({...})
 *   import { Schema } from 'mongoose';      new Schema({...})
 *   import { Schema as S } from 'mongoose'; new S({...})
 *   const { Schema } = require('mongoose'); new Schema({...})
 *
 * Matching is anchored to the import, not to the identifier `Schema`: plenty
 * of codebases have a `Schema` of their own — a GraphQL one, a Zod one — and
 * linting it as a Mongoose model is how a linter earns its reputation.
 */

import { Node, SyntaxKind } from 'ts-morph';
import type {
  NewExpression,
  ObjectBindingPattern,
  ObjectLiteralExpression,
  SourceFile,
} from 'ts-morph';

const MONGOOSE = /^mongoose(\/|$)/;

/**
 * Every expression text that constructs a Mongoose schema in this file.
 *
 * Two sets, because real codebases rename things:
 *
 *   namespaces    `mongoose` — anything whose `.Schema` is a schema
 *   constructors  `Schema`, `mongoose.Schema`, and every local alias of them
 *
 * The alias pass is not a nicety. `const Schema = mongoose.Schema` at the top
 * of a model file is one of the most common idioms in Mongoose code, and a
 * matcher that only knows the import forms reports a clean run on a codebase
 * written that way — the exact failure this tool is supposed to make
 * impossible.
 */
export function schemaConstructors(file: SourceFile): Set<string> {
  const namespaces = new Set<string>();
  const constructors = new Set<string>();

  for (const declaration of file.getImportDeclarations()) {
    if (!MONGOOSE.test(declaration.getModuleSpecifierValue())) continue;

    const defaultImport = declaration.getDefaultImport()?.getText();
    if (defaultImport !== undefined) namespaces.add(defaultImport);

    const namespaceImport = declaration.getNamespaceImport()?.getText();
    if (namespaceImport !== undefined) namespaces.add(namespaceImport);

    for (const specifier of declaration.getNamedImports()) {
      if (specifier.getName() === 'Schema') {
        constructors.add(specifier.getAliasNode()?.getText() ?? 'Schema');
      }
    }
  }

  for (const declaration of file.getVariableDeclarations()) {
    const initializer = declaration.getInitializer();
    if (initializer === undefined || !isMongooseRequire(initializer)) continue;

    const nameNode = declaration.getNameNode();
    if (Node.isIdentifier(nameNode)) {
      namespaces.add(nameNode.getText());
    } else if (Node.isObjectBindingPattern(nameNode)) {
      // `const { Schema } = require('mongoose')`
      for (const binding of schemaBindingsOf(nameNode)) constructors.add(binding);
    }
  }

  if (namespaces.size === 0 && constructors.size === 0) return constructors;

  resolveAliases(file, namespaces, constructors);
  for (const namespace of namespaces) constructors.add(`${namespace}.Schema`);
  return constructors;
}

/**
 * Follow local aliases until nothing new appears:
 *
 *   const Schema = mongoose.Schema;      an alias of the constructor
 *   const { Schema } = mongoose;         the same, destructured
 *   const db = mongoose;                 an alias of the namespace
 *
 * A fixpoint rather than a single pass, because an alias of an alias is not
 * unusual in a file that re-exports its own helpers.
 */
function resolveAliases(
  file: SourceFile,
  namespaces: Set<string>,
  constructors: Set<string>,
): void {
  const declarations = file.getVariableDeclarations();
  let changed = true;

  while (changed) {
    changed = false;

    for (const declaration of declarations) {
      const initializer = declaration.getInitializer();
      if (initializer === undefined) continue;

      const source = initializer.getText();
      const nameNode = declaration.getNameNode();

      if (Node.isIdentifier(nameNode)) {
        const name = nameNode.getText();
        const isConstructor =
          constructors.has(source) || [...namespaces].some((ns) => source === `${ns}.Schema`);

        if (isConstructor && !constructors.has(name)) {
          constructors.add(name);
          changed = true;
        } else if (namespaces.has(source) && !namespaces.has(name)) {
          namespaces.add(name);
          changed = true;
        }
        continue;
      }

      if (Node.isObjectBindingPattern(nameNode) && namespaces.has(source)) {
        for (const binding of schemaBindingsOf(nameNode)) {
          if (!constructors.has(binding)) {
            constructors.add(binding);
            changed = true;
          }
        }
      }
    }
  }
}

/** The local names bound to `Schema` by a destructuring pattern. */
function schemaBindingsOf(pattern: ObjectBindingPattern): string[] {
  return pattern
    .getElements()
    .filter((element) => (element.getPropertyNameNode()?.getText() ?? element.getName()) === 'Schema')
    .map((element) => element.getName());
}

function isMongooseRequire(node: Node): boolean {
  if (!Node.isCallExpression(node)) return false;
  if (node.getExpression().getText() !== 'require') return false;
  const [specifier] = node.getArguments();
  return Node.isStringLiteral(specifier) && MONGOOSE.test(specifier.getLiteralValue());
}

export interface SchemaCall {
  readonly node: NewExpression;
  /** How the schema is named in reports: the variable, the model, or a fallback. */
  readonly name: string;
  /** The variable it was assigned to, needed to match `schema.index(...)` calls. */
  readonly variable?: string;
  /** The definition object, when it was written in place. */
  readonly definition?: ObjectLiteralExpression;
  /** The definition argument as written, for the unresolved report. */
  readonly definitionArgument?: Node;
  /** The `new Schema(definition, options)` second argument. */
  readonly options?: ObjectLiteralExpression;
}

export function findSchemaCalls(file: SourceFile): SchemaCall[] {
  const constructors = schemaConstructors(file);
  if (constructors.size === 0) return [];

  return file
    .getDescendantsOfKind(SyntaxKind.NewExpression)
    .filter((call) => constructors.has(call.getExpression().getText()))
    .map((call) => {
      const [definition, options] = call.getArguments();
      const variable = variableNameOf(call);

      return {
        node: call,
        name: variable ?? modelNameOf(call) ?? '<anonymous schema>',
        ...(variable === undefined ? {} : { variable }),
        ...(definition !== undefined && Node.isObjectLiteralExpression(definition)
          ? { definition }
          : {}),
        ...(definition === undefined ? {} : { definitionArgument: definition }),
        ...(options !== undefined && Node.isObjectLiteralExpression(options) ? { options } : {}),
      };
    });
}

/** `const UserSchema = new Schema(...)` → `UserSchema`. */
function variableNameOf(call: NewExpression): string | undefined {
  const declaration = call.getParentIfKind(SyntaxKind.VariableDeclaration);
  const nameNode = declaration?.getNameNode();
  return nameNode !== undefined && Node.isIdentifier(nameNode) ? nameNode.getText() : undefined;
}

/** `model('User', new Schema(...))` → `User`, for schemas never given a name. */
function modelNameOf(call: NewExpression): string | undefined {
  const parent = call.getParent();
  if (parent === undefined || !Node.isCallExpression(parent)) return undefined;

  const callee = parent.getExpression();
  const isModelCall =
    (Node.isPropertyAccessExpression(callee) && callee.getName() === 'model') ||
    callee.getText() === 'model';
  if (!isModelCall) return undefined;

  const [first] = parent.getArguments();
  return Node.isStringLiteral(first) ? first.getLiteralValue() : undefined;
}

/** Schema variables declared in this file, so `[CommentSchema]` resolves. */
export function knownSchemaVariables(calls: readonly SchemaCall[]): Set<string> {
  return new Set(
    calls.map((call) => call.variable).filter((name): name is string => name !== undefined),
  );
}
