/**
 * A codebase backed by ts-morph's in-memory file system.
 *
 * Unit tests of the parser should not touch the disk, and should be able to
 * state the source under test inline — a two-line schema next to the assertion
 * about it is worth more than a fixture file three directories away.
 */

import { Project } from 'ts-morph';
import type { SchemaRead } from '../../src/application/ports.ts';
import type { SchemaModel } from '../../src/domain/index.ts';
import type { TsMorphCodebase } from '../../src/infrastructure/codebase/ts-morph-codebase.ts';
import { createSchemaReader } from '../../src/infrastructure/schema/ts-morph-schema-reader.ts';

export function inMemoryCodebase(files: Record<string, string>): TsMorphCodebase {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { allowJs: true },
  });

  const sourceFiles = Object.entries(files).map(([path, text]) =>
    project.createSourceFile(`/${path}`, text),
  );

  return {
    root: '/',
    fileCount: sourceFiles.length,
    sourceFiles: () => sourceFiles,
    relativePath: (file) => file.getFilePath().replace(/^\//, ''),
  };
}

export function readSchemas(files: Record<string, string>): SchemaRead {
  return createSchemaReader(inMemoryCodebase(files)).read();
}

/** The common case: one file, one schema, and an assertion about it. */
export function readOneSchema(source: string): SchemaModel {
  const { schemas } = readSchemas({ 'model.ts': source });
  if (schemas.length !== 1) {
    throw new Error(`expected exactly one schema, parsed ${schemas.length}`);
  }
  return schemas[0]!;
}

/** A schema definition wrapped in the boilerplate every fixture repeats. */
export function schemaSource(definition: string, options = ''): string {
  return [
    "import { Schema } from 'mongoose';",
    '',
    `export const TestSchema = new Schema(${definition}${options === '' ? '' : `, ${options}`});`,
    '',
  ].join('\n');
}
