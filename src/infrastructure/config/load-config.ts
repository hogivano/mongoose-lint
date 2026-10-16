/**
 * Finding and loading `mongoose-lint.config.*`.
 *
 * The config file is imported, not evaluated in a sandbox, which is the one
 * place this tool runs code that is not its own — and it is the user's own
 * config, by their explicit choice of file name. Nothing in a *model* file is
 * ever executed, which is the promise that matters.
 */

import { readFile, stat } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { MongooseLintConfig, Severity } from '../../domain/index.ts';
import { ConfigError, isSeverity } from '../../domain/index.ts';
import type { ConfigPort } from '../../application/ports.ts';

/** In precedence order. The first one found in a directory wins. */
const CONFIG_NAMES = [
  'mongoose-lint.config.ts',
  'mongoose-lint.config.mts',
  'mongoose-lint.config.js',
  'mongoose-lint.config.mjs',
  'mongoose-lint.config.json',
];

export interface LoadConfigOptions {
  /** Directory to search from. Searched upwards to the file system root. */
  root: string;
  /** An explicit `--config` path. Missing files are an error, not a fallback. */
  path?: string;
}

const EMPTY: ConfigPort = { config: {} };

export async function loadConfig(options: LoadConfigOptions): Promise<ConfigPort> {
  const explicit = options.path;

  if (explicit !== undefined) {
    const path = isAbsolute(explicit) ? explicit : resolve(options.root, explicit);
    return { config: validate(await importConfig(path), path), path };
  }

  const found = await findUpwards(resolve(options.root));
  if (found === undefined) return EMPTY;

  return { config: validate(await importConfig(found), found), path: found };
}

async function findUpwards(from: string): Promise<string | undefined> {
  let directory = from;

  for (;;) {
    for (const name of CONFIG_NAMES) {
      const candidate = resolve(directory, name);
      if (await exists(candidate)) return candidate;
    }
    const parent = dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function importConfig(path: string): Promise<unknown> {
  if (path.endsWith('.json')) {
    try {
      return JSON.parse(await readFile(path, 'utf8'));
    } catch (error) {
      throw new ConfigError(`could not read ${path}`, messageOf(error));
    }
  }

  try {
    const module = (await import(pathToFileURL(path).href)) as { default?: unknown };
    return module.default ?? module;
  } catch (error) {
    throw new ConfigError(
      `could not load ${path}`,
      path.endsWith('.ts')
        ? 'A TypeScript config needs Node 22.18+ (which strips types natively), or rename it to .mjs / .json.'
        : messageOf(error),
    );
  }
}

/**
 * Validate the shape here rather than trusting the file.
 *
 * A config is the one input that can silently disable the whole tool, so a
 * typo in it has to be loud. `rules: { 'unique-on-optional': 'error' }` — one
 * character short of a real id — must not be a rule that never fires; unknown
 * ids are rejected later, against the registry.
 */
function validate(value: unknown, path: string): MongooseLintConfig {
  if (typeof value !== 'object' || value === null) {
    throw new ConfigError(
      `${path} does not export a config object`,
      'Export a default object: `export default defineConfig({ rules: { ... } })`.',
    );
  }

  const raw = value as Record<string, unknown>;
  const config: {
    include?: readonly string[];
    exclude?: readonly string[];
    rules?: Record<string, Severity>;
  } = {};

  if (raw['include'] !== undefined) config.include = globs(raw['include'], 'include', path);
  if (raw['exclude'] !== undefined) config.exclude = globs(raw['exclude'], 'exclude', path);

  if (raw['rules'] !== undefined) {
    if (typeof raw['rules'] !== 'object' || raw['rules'] === null) {
      throw new ConfigError(`${path}: "rules" must be an object of ruleId → severity`);
    }
    const rules: Record<string, Severity> = {};
    for (const [ruleId, severity] of Object.entries(raw['rules'] as Record<string, unknown>)) {
      if (typeof severity !== 'string' || !isSeverity(severity)) {
        throw new ConfigError(
          `${path}: severity for "${ruleId}" must be "error", "warn" or "off"`,
          `Got ${JSON.stringify(severity)}.`,
        );
      }
      rules[ruleId] = severity;
    }
    config.rules = rules;
  }

  return config;
}

function globs(value: unknown, field: string, path: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new ConfigError(`${path}: "${field}" must be an array of glob strings`);
  }
  return value as string[];
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
