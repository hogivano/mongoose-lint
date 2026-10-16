import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UsageError } from '../../src/domain/index.ts';
import { parseArgs } from '../../src/presentation/cli/args.ts';

describe('argument parsing', () => {
  it('defaults to linting the working directory', () => {
    const args = parseArgs([]);
    assert.equal(args.command, 'lint');
    assert.equal(args.root, '.');
  });

  it('takes a command and a path', () => {
    assert.deepEqual(
      { ...parseArgs(['lint', './src']) },
      { ...parseArgs([]), command: 'lint', root: './src' },
    );
  });

  it('reads repeated --rule overrides', () => {
    const args = parseArgs(['--rule', 'ref-without-index=warn', '--rule', 'unbounded-array=off']);
    assert.deepEqual(args.rules, { 'ref-without-index': 'warn', 'unbounded-array': 'off' });
  });

  it('rejects a severity that is not one of the three', () => {
    assert.throws(() => parseArgs(['--rule', 'ref-without-index=loud']), UsageError);
  });

  it('rejects an unknown option rather than ignoring it', () => {
    assert.throws(() => parseArgs(['--strictt']), UsageError);
  });

  it('rejects a second path argument', () => {
    assert.throws(() => parseArgs(['./src', './lib']), UsageError);
  });
});
