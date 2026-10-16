/**
 * What gets scanned, and — the part with teeth — what does not.
 *
 * The ignore list is the difference between linting a repo and reading every
 * vendored file in it, and a glob that quietly matches nothing looks exactly
 * like a glob that works.
 */

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { NoSourceFilesError } from '../../src/domain/index.ts';
import { createCodebase } from '../../src/infrastructure/codebase/ts-morph-codebase.ts';

const SCHEMA = [
  "import { Schema } from 'mongoose';",
  'export const S = new Schema({ a: String });',
].join('\n');

async function repo(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mongoose-lint-repo-'));

  for (const [path, contents] of Object.entries(files)) {
    const full = join(root, path);
    await mkdir(join(full, '..'), { recursive: true });
    await writeFile(full, contents);
  }

  return root;
}

/**
 * Paths are read inside the loop on purpose: a parsed file is only valid while
 * the iteration is on it, which is what keeps a monorepo scan in memory.
 */
function scanned(root: string, options = {}): string[] {
  const paths: string[] = [];
  for (const file of createCodebase({ root, ...options }).sourceFiles()) {
    paths.push(file.getFilePath().replace(root, ''));
  }
  return paths.sort();
}

describe('codebase', () => {
  it('never scans node_modules, dist, or .d.ts files', async () => {
    const root = await repo({
      'src/user.ts': SCHEMA,
      'node_modules/mongoose/index.js': SCHEMA,
      'dist/user.js': SCHEMA,
      'src/user.d.ts': SCHEMA,
    });

    assert.deepEqual(scanned(root), ['/src/user.ts']);
  });

  it('skips files that cannot mention Mongoose, without parsing them', async () => {
    const root = await repo({
      'src/user.ts': SCHEMA,
      'src/unrelated.ts': 'export const answer = 42;',
    });

    assert.deepEqual(scanned(root), ['/src/user.ts']);
  });

  it('honours an exclude glob written relative to the root', async () => {
    const root = await repo({ 'src/user.ts': SCHEMA, 'src/legacy/old.ts': SCHEMA });

    assert.deepEqual(scanned(root, { exclude: ['**/legacy/**'] }), ['/src/user.ts']);
  });

  it('counts every candidate file, not only the ones it parsed', async () => {
    const root = await repo({ 'src/user.ts': SCHEMA, 'src/unrelated.ts': 'export const a = 1;' });

    assert.equal(createCodebase({ root }).fileCount, 2);
  });

  it('refuses a directory with no source in it, with a hint', async () => {
    const root = await repo({ 'README.md': '# nothing to lint' });

    assert.throws(() => createCodebase({ root }), NoSourceFilesError);
  });
});
