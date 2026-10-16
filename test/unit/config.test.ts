/**
 * Config loading, including the failures. A config file is the one input that
 * can silently switch the whole tool off, so every way of getting it wrong has
 * to produce a message rather than a default.
 */

import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { ConfigError } from '../../src/domain/index.ts';
import { loadConfig } from '../../src/infrastructure/config/load-config.ts';

async function withConfig(name: string, contents: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'mongoose-lint-'));
  await writeFile(join(directory, name), contents);
  return directory;
}

describe('config loading', () => {
  it('finds mongoose-lint.config.json next to the linted code', async () => {
    const root = await withConfig(
      'mongoose-lint.config.json',
      JSON.stringify({ rules: { 'ref-without-index': 'warn' }, exclude: ['**/legacy/**'] }),
    );

    const { config, path } = await loadConfig({ root });

    assert.deepEqual(config.rules, { 'ref-without-index': 'warn' });
    assert.deepEqual(config.exclude, ['**/legacy/**']);
    assert.match(path ?? '', /mongoose-lint\.config\.json$/);
  });

  it('finds a config in a parent directory', async () => {
    const root = await withConfig('mongoose-lint.config.json', '{"rules":{}}');
    const { path } = await loadConfig({ root: join(root, 'src') });
    assert.match(path ?? '', /mongoose-lint\.config\.json$/);
  });

  it('rejects a severity that is not one of the three', async () => {
    const root = await withConfig(
      'mongoose-lint.config.json',
      JSON.stringify({ rules: { 'ref-without-index': 'loud' } }),
    );

    await assert.rejects(() => loadConfig({ root }), ConfigError);
  });

  it('rejects an explicit --config that does not exist', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mongoose-lint-'));
    await assert.rejects(() => loadConfig({ root, path: 'nope.json' }), ConfigError);
  });
});
