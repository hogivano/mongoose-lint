/**
 * The SchemaReaderPort: source files in, resolved `SchemaModel`s out.
 *
 * This is the layer everything else depends on being honest.
 * It is the only place in the tool that touches an AST, and the only place
 * allowed to decide that something cannot be read — which it records rather
 * than skips. A file it cannot parse is reported as a gap in the run, never as
 * a clean file.
 */

import type { ObjectLiteralExpression } from 'ts-morph';
import type { DisableDirective, SchemaModel, UnresolvedSite } from '../../domain/index.ts';
import type { SchemaRead, SchemaReaderPort } from '../../application/ports.ts';
import type { TsMorphCodebase } from '../codebase/ts-morph-codebase.ts';
import { inSchema, locationOf, unresolvedAt, type ReadContext } from './context.ts';
import { readDirectives } from './directives.ts';
import { indexesFromCalls, indexesFromPaths } from './indexes.ts';
import { readPaths } from './paths.ts';
import { findSchemaCalls, knownSchemaVariables, type SchemaCall } from './schema-calls.ts';
import { optionsOf } from './values.ts';

export function createSchemaReader(codebase: TsMorphCodebase): SchemaReaderPort {
  return {
    read(): SchemaRead {
      const schemas: SchemaModel[] = [];
      const unresolved: UnresolvedSite[] = [];
      const directives: DisableDirective[] = [];

      for (const file of codebase.sourceFiles()) {
        const path = codebase.relativePath(file);
        const calls = findSchemaCalls(file);
        if (calls.length === 0) continue;

        directives.push(...readDirectives(file, path));

        const context: ReadContext = {
          file,
          path,
          knownSchemas: knownSchemaVariables(calls),
        };

        for (const call of calls) {
          // `new Schema(definitionBuiltElsewhere)` — a factory, a spread, a
          // variable. Nothing can be said about it, so we say that.
          const definition = call.definition;
          if (definition === undefined) {
            unresolved.push(
              unresolvedAt(
                inSchema(context, call.name),
                call.definitionArgument ?? call.node,
                'schema definition is not an object literal',
              ),
            );
            continue;
          }

          schemas.push(toModel(call, definition, context));
        }
      }

      return { schemas, unresolved, directives };
    },
  };
}

function toModel(
  call: SchemaCall,
  definition: ObjectLiteralExpression,
  context: ReadContext,
): SchemaModel {
  const { paths, unresolved } = readPaths(definition, inSchema(context, call.name));

  return {
    name: call.name,
    location: locationOf(context, call.node),
    paths,
    indexes: [...indexesFromPaths(paths), ...indexesFromCalls(context, call.variable)],
    options: call.options === undefined ? {} : optionsOf(call.options),
    unresolved,
  };
}
