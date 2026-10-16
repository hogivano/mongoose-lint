/**
 * `mongoose-lint rules` — the tool explaining itself.
 *
 * Off rules are listed with the on ones, and marked. Someone deciding whether
 * to trust a clean report needs to see what was not checked at least as much
 * as what was.
 */

import type { RuleListing } from '../../application/use-cases/list-rules.ts';
import { dim, red, yellow } from './colour.ts';

export function formatRules(rules: readonly RuleListing[], verbose = false): string {
  const width = Math.max(...rules.map((rule) => rule.id.length));
  const lines: string[] = [''];

  for (const rule of rules) {
    lines.push(
      `  ${severityLabel(rule)}  ${rule.id.padEnd(width)}  ${rule.title}`,
      `         ${' '.repeat(width)}  ${dim(confidenceLabel(rule))}`,
    );

    if (verbose) {
      lines.push('', indent(rule.explain, 9 + width), '', `${' '.repeat(9 + width)}${dim(rule.docs)}`);
    }
    lines.push('');
  }

  lines.push(
    `  ${dim('Turn a rule on in mongoose-lint.config.ts:')}`,
    `  ${dim("  export default defineConfig({ rules: { 'ref-without-index': 'warn' } })")}`,
    `  ${dim('or for one run: --rule ref-without-index=warn')}`,
    '',
  );

  return lines.join('\n');
}

function severityLabel(rule: RuleListing): string {
  if (rule.severity === 'error') return red('error');
  if (rule.severity === 'warn') return yellow('warn ');
  return dim('off  ');
}

function confidenceLabel(rule: RuleListing): string {
  const parts: string[] = [rule.confidence];
  if (rule.antiPattern !== undefined) parts.push(`MongoDB anti-pattern: ${rule.antiPattern}`);
  if (rule.severity !== rule.defaultSeverity) parts.push(`default: ${rule.defaultSeverity}`);
  return parts.join(' · ');
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line ? pad + line : line))
    .join('\n');
}
