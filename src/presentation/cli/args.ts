/**
 * Argument parsing, kept apart from the wiring so it can be tested without
 * touching a file system.
 *
 * An unknown flag is an error, never ignored: the user asked for behaviour
 * they would not otherwise get, and silently dropping `--strict` is how a
 * green CI run stops meaning anything.
 */

import { UsageError, isSeverity, type Severity } from '../../domain/index.ts';

export type Command = 'lint' | 'rules';

export interface ParsedArgs {
  readonly command: Command;
  /** Directory to lint. Defaults to the working directory. */
  root: string;
  config?: string;
  /** From `--rule id=severity`, applied over the config file. */
  rules: Record<string, Severity>;
  only?: string[];
  ignore?: string[];
  json: boolean;
  /** Warnings and unresolved schemas also fail the run. */
  strict: boolean;
  /** List every finding, not the first few per schema. */
  all: boolean;
  /** `rules` command: print each rule's full explanation. */
  verbose: boolean;
  help: boolean;
  version: boolean;
}

const COMMANDS: readonly string[] = ['lint', 'rules'];

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const first = argv[0];
  const hasCommand = first !== undefined && COMMANDS.includes(first);
  const rest = hasCommand ? argv.slice(1) : argv;

  const parsed: ParsedArgs = {
    command: (hasCommand ? first : 'lint') as Command,
    root: '.',
    rules: {},
    json: false,
    strict: false,
    all: false,
    verbose: false,
    help: false,
    version: false,
  };

  let sawRoot = false;

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!;

    const value = (): string => {
      const next = rest[++i];
      if (next === undefined || next.startsWith('-')) throw new UsageError(`${arg} needs a value`);
      return next;
    };

    switch (arg) {
      case '-h':
      case '--help':
        parsed.help = true;
        break;
      case '-v':
      case '--version':
        parsed.version = true;
        break;
      case '--json':
        parsed.json = true;
        break;
      case '--strict':
        parsed.strict = true;
        break;
      case '--all':
        parsed.all = true;
        break;
      case '--verbose':
        parsed.verbose = true;
        break;
      case '--config':
        parsed.config = value();
        break;
      case '--rule':
        Object.assign(parsed.rules, ruleOverride(value()));
        break;
      case '--only':
        parsed.only = splitList(value());
        break;
      case '--ignore':
        parsed.ignore = [...(parsed.ignore ?? []), value()];
        break;
      default: {
        if (arg.startsWith('-')) throw new UsageError(`unknown option ${arg}`);
        if (sawRoot) throw new UsageError(`unexpected argument "${arg}"`);
        parsed.root = arg;
        sawRoot = true;
      }
    }
  }

  return parsed;
}

/** `--rule unique-on-optional-field=warn` */
function ruleOverride(value: string): Record<string, Severity> {
  const [id, severity] = value.split('=');

  if (id === undefined || id === '' || severity === undefined) {
    throw new UsageError(
      `--rule expects <rule-id>=<severity>, got "${value}"`,
      'e.g. --rule ref-without-index=warn',
    );
  }
  if (!isSeverity(severity)) {
    throw new UsageError(`--rule ${id}: severity must be error, warn or off, got "${severity}"`);
  }

  return { [id]: severity };
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
