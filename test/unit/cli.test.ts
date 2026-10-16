/**
 * The wiring, end to end: real files, real parser, real rules, real exit code.
 *
 * Everything below the CLI is unit-tested elsewhere; what this proves is that
 * the composition root connects them, and that the contract CI depends on —
 * the exit code — is the one documented in --help.
 */

import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, mock } from 'node:test';
import { EXIT } from '../../src/domain/index.ts';
import { main } from '../../src/presentation/cli/cli.ts';

const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures');
const fixture = (name: string) => resolve(FIXTURES, name);

/** Runs the CLI with stdout captured, so the suite stays readable. */
async function run(argv: string[]): Promise<{ code: number; output: string }> {
  const lines: string[] = [];
  const log = mock.method(console, 'log', (line: string) => void lines.push(line));
  const error = mock.method(console, 'error', () => {});

  try {
    return { code: await main(argv), output: lines.join('\n') };
  } finally {
    log.mock.restore();
    error.mock.restore();
  }
}

describe('cli', () => {
  it('exits 1 with findings, and names the rule and the fix', async () => {
    const { code, output } = await run([fixture('unique-on-optional-field')]);

    assert.equal(code, EXIT.FINDINGS);
    assert.match(output, /unique-on-optional-field/);
    assert.match(output, /partialFilterExpression/);
  });

  it('exits 0 when the enabled rules have nothing to say', async () => {
    const { code } = await run([fixture('case-insensitive-unique')]);
    assert.equal(code, EXIT.CLEAN);
  });

  it('exits 2 on a directory with no source in it', async () => {
    const { code } = await run([fixture('does-not-exist')]);
    assert.equal(code, EXIT.ERROR);
  });

  it('reports unresolved schemas, and fails on them only under --strict', async () => {
    const relaxed = await run([fixture('unresolved')]);
    assert.equal(relaxed.code, EXIT.CLEAN);
    assert.match(relaxed.output, /UNRESOLVED \(3\)/);

    const strict = await run([fixture('unresolved'), '--strict']);
    assert.equal(strict.code, EXIT.FINDINGS);
  });

  it('turns a rule on for one run with --rule', async () => {
    const { code, output } = await run([
      fixture('unbounded-array'),
      '--only',
      'unbounded-array',
      '--rule',
      'unbounded-array=error',
    ]);

    assert.equal(code, EXIT.FINDINGS);
    assert.match(output, /comments/);
  });

  it('prints every rule, including the ones that are off', async () => {
    const { code, output } = await run(['rules']);

    assert.equal(code, EXIT.CLEAN);
    assert.match(output, /unbounded-array/);
    assert.match(output, /off/);
  });

  it('exits 2 on an unknown option instead of ignoring it', async () => {
    const { code } = await run(['--strictt']);
    assert.equal(code, EXIT.ERROR);
  });
});
