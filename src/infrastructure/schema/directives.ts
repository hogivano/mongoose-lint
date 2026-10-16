/**
 * Inline disable comments.
 *
 *   // mongoose-lint-disable-next-line unique-on-optional-field
 *   // mongoose-lint-disable-file redundant-index-prefix
 *   // mongoose-lint-disable                     (whole file, every rule)
 *
 * Read from the raw text rather than from comment nodes: a directive is a
 * line-oriented thing, it can appear inside a JSDoc block or after code, and
 * the alternative is walking trivia for no benefit.
 */

import type { SourceFile } from 'ts-morph';
import type { DisableDirective } from '../../domain/index.ts';

const DIRECTIVE = /(?:\/\/|\/\*|^\s*\*)\s*mongoose-lint-disable(-next-line|-file)?\b([^*\n]*)/;

export function readDirectives(file: SourceFile, path: string): DisableDirective[] {
  const directives: DisableDirective[] = [];

  file.getFullText().split('\n').forEach((text, index) => {
    const match = DIRECTIVE.exec(text);
    if (match === null) return;

    directives.push({
      file: path,
      line: index + 1,
      scope: match[1] === '-next-line' ? 'next-line' : 'file',
      ruleIds: ruleIdsIn(match[2] ?? ''),
    });
  });

  return directives;
}

/** `unique-on-optional-field, redundant-index-prefix -- because X` → the two ids. */
function ruleIdsIn(tail: string): string[] {
  return tail
    .split('--')[0]!
    .split(/[,\s]+/)
    .map((entry) => entry.trim().replace(/\*\/$/, ''))
    .filter((entry) => /^[a-z][a-z0-9-]*$/.test(entry));
}
