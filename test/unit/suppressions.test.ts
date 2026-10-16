import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lintFixture } from '../support/fixtures.ts';
import { readDirectives } from '../../src/infrastructure/schema/directives.ts';
import { inMemoryCodebase } from '../support/in-memory.ts';

describe('inline disable comments', () => {
  const report = lintFixture('suppression', 'unique-on-optional-field');

  it('suppresses the next line only, and only the named rule', () => {
    assert.deepEqual(report.findings.map((finding) => finding.subject), ['handle']);
  });

  it('counts what it suppressed rather than losing it', () => {
    assert.equal(report.suppressed, 1);
  });

  it('parses both scopes and a bare list of ids', () => {
    const [file] = inMemoryCodebase({
      'model.ts': [
        '// mongoose-lint-disable-next-line unique-on-optional-field',
        '// mongoose-lint-disable-file redundant-index-prefix, ref-without-index',
        '// mongoose-lint-disable',
      ].join('\n'),
    }).sourceFiles();

    assert.deepEqual(readDirectives(file!, 'model.ts'), [
      { file: 'model.ts', line: 1, scope: 'next-line', ruleIds: ['unique-on-optional-field'] },
      {
        file: 'model.ts',
        line: 2,
        scope: 'file',
        ruleIds: ['redundant-index-prefix', 'ref-without-index'],
      },
      { file: 'model.ts', line: 3, scope: 'file', ruleIds: [] },
    ]);
  });
});
