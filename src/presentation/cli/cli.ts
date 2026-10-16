#!/usr/bin/env node
/**
 * The composition root: the only file that knows both a use case and an
 * adapter. Everything below it is wired by hand, which is why replacing the
 * ts-morph reader — or adding an ESLint front end — is a change to this file
 * and nothing else.
 */

import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lint, listRules, type SeverityOverrides } from '../../application/index.ts';
import { EXIT, LintError, exitCodeFor, type ExitCode } from '../../domain/index.ts';
import { createCodebase } from '../../infrastructure/codebase/ts-morph-codebase.ts';
import { loadConfig } from '../../infrastructure/config/load-config.ts';
import { createRuleRegistry } from '../../infrastructure/rules/registry.ts';
import { createSchemaReader } from '../../infrastructure/schema/ts-morph-schema-reader.ts';
import { createSystemClock } from '../../infrastructure/system-clock.ts';
import { formatReport } from '../report/human.ts';
import { reportToJson, rulesToJson } from '../report/json.ts';
import { formatRules } from '../report/rules.ts';
import { parseArgs, type ParsedArgs } from './args.ts';
import { help } from './help.ts';

export async function main(argv: readonly string[]): Promise<ExitCode> {
  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    return fail(error);
  }

  if (args.help) {
    console.log(help());
    return EXIT.CLEAN;
  }
  if (args.version) {
    console.log(version());
    return EXIT.CLEAN;
  }

  try {
    return await run(args);
  } catch (error) {
    return fail(error);
  }
}

async function run(args: ParsedArgs): Promise<ExitCode> {
  const registry = createRuleRegistry();
  const { config } = await loadConfig({
    root: args.root,
    ...(args.config === undefined ? {} : { path: args.config }),
  });

  const overrides: SeverityOverrides = {
    ...(config.rules === undefined ? {} : { config: config.rules }),
    cli: args.rules,
    ...(args.only === undefined ? {} : { only: args.only }),
  };

  if (args.command === 'rules') {
    const listing = listRules(registry, overrides);
    console.log(args.json ? rulesToJson(listing) : formatRules(listing, args.verbose));
    return EXIT.CLEAN;
  }

  const codebase = createCodebase({
    root: args.root,
    ...(config.include === undefined ? {} : { include: config.include }),
    exclude: [...(config.exclude ?? []), ...(args.ignore ?? [])],
  });

  const report = lint({
    codebase,
    reader: createSchemaReader(codebase),
    registry,
    clock: createSystemClock(),
  }, { overrides });

  console.log(
    args.json
      ? reportToJson(report)
      : formatReport(report, {
          registry,
          ...(args.all ? { maxSites: Number.MAX_SAFE_INTEGER } : {}),
        }),
  );

  return exitCodeFor(report, { strict: args.strict });
}

/**
 * A LintError is a decision the tool made on purpose, so it prints as a
 * message and a hint. Anything else is a bug and keeps its stack.
 */
function fail(error: unknown): ExitCode {
  if (error instanceof LintError) {
    console.error(`mongoose-lint: ${error.message}`);
    if (error.hint) console.error(`\n${error.hint}`);
  } else {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  }
  return EXIT.ERROR;
}

function version(): string {
  try {
    const path = new URL('../../../package.json', import.meta.url);
    return (JSON.parse(readFileSync(path, 'utf8')) as { version: string }).version;
  } catch {
    return 'unknown';
  }
}

// Only run when invoked as a binary; importing this module must not exit.
if (isEntryPoint()) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = EXIT.ERROR;
    },
  );
}

function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(entry) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}
