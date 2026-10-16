/**
 * The file set, over ts-morph.
 *
 * ts-morph rather than a bare TypeScript AST: the target codebases
 * are TypeScript, and ts-morph handles both TS and JS with one API. Nothing
 * here executes the project — no tsconfig, no module resolution, no imports
 * followed. A linter that has to install your dependencies to run is a linter
 * that does not run in CI.
 *
 * Files are parsed one at a time and dropped afterwards. Holding every AST at
 * once costs about a gigabyte per few thousand files, which a monorepo reaches
 * easily — and there is no reason to hold them: a `SchemaModel` is plain data,
 * and nothing downstream of the reader touches a node again.
 */

import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { Project, type SourceFile } from 'ts-morph';
import { NoSourceFilesError } from '../../domain/index.ts';
import type { CodebasePort } from '../../application/ports.ts';

/** Everything a schema could plausibly live in. */
const SOURCE_GLOBS = [
  '**/*.ts',
  '**/*.tsx',
  '**/*.mts',
  '**/*.cts',
  '**/*.js',
  '**/*.mjs',
  '**/*.cjs',
];

/**
 * Never scanned. Generated output and vendored code produce findings nobody
 * can act on, and `node_modules` alone would dominate every report.
 */
const ALWAYS_IGNORED = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.git/**',
  '**/*.d.ts',
];

export interface CodebaseOptions {
  /** Directory to scan. */
  root: string;
  /** Globs to lint, relative to the root. Defaults to every source file. */
  include?: readonly string[];
  /** Extra ignore globs, from config or --ignore. */
  exclude?: readonly string[];
}

/** The port, plus the two things the schema reader needs from ts-morph. */
export interface TsMorphCodebase extends CodebasePort {
  /**
   * Every candidate file, parsed lazily. A file is valid only while the
   * iteration is on it: the parse is released as soon as the consumer moves on.
   */
  sourceFiles(): Iterable<SourceFile>;
  /** Root-relative path. Reports never print absolute paths. */
  relativePath(file: SourceFile): string;
}

export function createCodebase(options: CodebaseOptions): TsMorphCodebase {
  const root = resolve(options.root);

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    compilerOptions: { allowJs: true },
  });

  const include = options.include ?? SOURCE_GLOBS;

  // Both halves are anchored at the root. A negation written relative — plain
  // `!**/node_modules/**` — silently matches nothing against absolute paths,
  // and the first symptom is a monorepo scan that reads 200,000 vendored files.
  const paths = project.getFileSystem().globSync([
    ...include.map((glob) => anchor(root, glob)),
    ...[...ALWAYS_IGNORED, ...(options.exclude ?? [])].map((glob) => `!${anchor(root, glob)}`),
  ]);

  if (paths.length === 0) {
    throw new NoSourceFilesError(
      `no JavaScript or TypeScript files under ${root}`,
      'Point mongoose-lint at the directory that contains your models, e.g. `mongoose-lint ./src`.',
    );
  }

  return {
    root,
    fileCount: paths.length,

    *sourceFiles(): Generator<SourceFile> {
      for (const path of paths) {
        const text = read(path);

        // The reader ignores any file that does not import Mongoose, so a file
        // whose text never mentions it cannot produce a schema. Skipping those
        // before parsing is the difference between reading a monorepo and
        // running out of memory in one.
        if (text === undefined || !text.includes('mongoose')) continue;

        const file = project.createSourceFile(path, text, { overwrite: true });
        try {
          yield file;
        } finally {
          project.removeSourceFile(file);
        }
      }
    },

    relativePath: (file) => relative(root, file.getFilePath()) || file.getBaseName(),
  };
}

/** Globs are written relative to the scan root; the file system is not. */
function anchor(root: string, glob: string): string {
  return glob.startsWith('/') ? glob : `${root}/${glob}`;
}

/** An unreadable file is skipped, not fatal: one bad symlink is not a run. */
function read(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
}
