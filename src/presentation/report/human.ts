/**
 * The report a person reads.
 *
 * Grouped by schema, because that is the unit someone fixes: they open
 * `models/user.ts`, look at one schema, and change it. Inside a schema the
 * errors come before the warnings.
 *
 * Two sections are printed even when they are boring — the rules that did not
 * run, and the schemas that could not be read. A linter's most dangerous
 * output is a clean report, and those are the two reasons a clean report might
 * not mean what it appears to mean.
 */

import {
  affectedFiles,
  errorsIn,
  formatLocation,
  groupByRule,
  groupBySchema,
  warningsIn,
  type Finding,
  type LintReport,
  type UnresolvedSite,
} from '../../domain/index.ts';
import type { RuleRegistryPort } from '../../application/ports.ts';
import { bold, dim, red, yellow } from './colour.ts';

export interface FormatOptions {
  readonly registry: RuleRegistryPort;
  /** Findings listed per schema before the rest are summarised. */
  readonly maxSites?: number;
}

const DEFAULT_MAX_SITES = 8;
const UNRESOLVED_SHOWN = 10;

export function formatReport(report: LintReport, options: FormatOptions): string {
  const lines: string[] = [
    '',
    `${bold('mongoose-lint')}  ${dim(report.root)}`,
    '',
    `  ${plural(report.filesScanned, 'file')} · ${plural(report.schemasFound, 'schema')} · ` +
      `${plural(report.rulesRun.length, 'rule')} enabled`,
    '',
  ];

  if (report.findings.length === 0) {
    lines.push(`  ${bold('No findings.')}`, '');
  } else {
    for (const [key, findings] of groupBySchema(report.findings)) {
      lines.push(...schemaSection(key, findings, options), '');
    }
    lines.push(...explanations(report.findings, options));
  }

  lines.push(...unresolvedSection(report.unresolved));
  lines.push(...summary(report));
  return lines.join('\n');
}

function schemaSection(
  key: string,
  findings: readonly Finding[],
  options: FormatOptions,
): string[] {
  const [file, schema] = key.split(' ');
  const lines = [`  ${bold(file ?? '')}  ${dim(schema ?? '')}`, ''];

  const shown = findings.slice(0, options.maxSites ?? DEFAULT_MAX_SITES);
  for (const finding of shown) {
    lines.push(`    ${label(finding)}  ${formatLocation(finding.location)}  ${finding.message}`);
    lines.push(
      `           ${dim(finding.ruleId)}` +
        (finding.note === undefined ? '' : dim(`  · ${finding.note}`)),
    );
    if (finding.fix !== undefined) lines.push(`           ${dim('fix:')} ${finding.fix}`);
    lines.push('');
  }

  const hidden = findings.length - shown.length;
  if (hidden > 0) {
    lines.push(`    ${dim(`… and ${hidden} more in this schema (--all lists them)`)}`);
  }

  return lines;
}

function label(finding: Finding): string {
  return finding.severity === 'error' ? red('error') : yellow('warn ');
}

/**
 * Each rule's explanation, once, under the findings.
 *
 * A finding that cannot be argued with is a finding that gets suppressed, so
 * the reasoning and the MongoDB link travel with the report rather than living
 * in a README nobody opens.
 */
function explanations(findings: readonly Finding[], options: FormatOptions): string[] {
  const lines: string[] = [];

  for (const [ruleId, group] of groupByRule(findings)) {
    const rule = options.registry.get(ruleId);
    if (rule === undefined) continue;

    lines.push(
      `  ${bold(rule.meta.title)}  ${dim(`${ruleId} · ${plural(group.length, 'finding')}`)}`,
      '',
      indent(rule.meta.explain, 4),
      '',
      `    ${dim(rule.meta.docs)}`,
      '',
    );
  }

  return lines;
}

/** The part of the report that is about this tool's limits, not your schemas. */
function unresolvedSection(unresolved: readonly UnresolvedSite[]): string[] {
  if (unresolved.length === 0) return [];

  const lines = [
    `  ${bold(`UNRESOLVED (${unresolved.length})`)}  ${dim('— read, but not understood. Not checked.')}`,
    '',
  ];

  for (const site of unresolved.slice(0, UNRESOLVED_SHOWN)) {
    lines.push(`    ${formatLocation(site.location)}  ${site.what}`, `      ${dim(site.text)}`);
  }
  if (unresolved.length > UNRESOLVED_SHOWN) {
    lines.push(`    ${dim(`… and ${unresolved.length - UNRESOLVED_SHOWN} more`)}`);
  }

  lines.push(
    '',
    `    ${dim('Schemas built dynamically — a spread, a factory, a variable. A static')}`,
    `    ${dim('parser cannot resolve them, so it reports them rather than guessing.')}`,
    `    ${dim('Treat them as unchecked, not as clean.')}`,
    '',
  );
  return lines;
}

function summary(report: LintReport): string[] {
  const errors = errorsIn(report).length;
  const warnings = warningsIn(report).length;
  const lines: string[] = [];

  if (report.findings.length > 0) {
    lines.push(
      `  ${plural(errors, 'error')} · ${plural(warnings, 'warning')} in ` +
        `${plural(affectedFiles(report.findings), 'file')}`,
    );
  }

  if (report.suppressed > 0) {
    lines.push(`  ${dim(`${plural(report.suppressed, 'finding')} suppressed by inline comments`)}`);
  }

  if (report.rulesSkipped.length > 0) {
    lines.push(
      '',
      `  ${dim(`${plural(report.rulesSkipped.length, 'rule')} off: ${report.rulesSkipped.join(', ')}`)}`,
      `  ${dim('`mongoose-lint rules` explains what each one checks, and why it is off.')}`,
    );
  }

  lines.push('');
  return lines;
}

function plural(count: number, noun: string): string {
  return `${count.toLocaleString('en-US')} ${noun}${count === 1 ? '' : 's'}`;
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line ? pad + line : line))
    .join('\n');
}
