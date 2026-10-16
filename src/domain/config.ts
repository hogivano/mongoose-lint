/**
 * The config file's shape.
 *
 * Rule toggles are the whole point of it: every rule beyond the two
 * deterministic ones ships off, and a team turns on what it has decided it
 * agrees with. Per-rule disable is what keeps a single noisy rule from getting
 * the whole tool switched off.
 */

import type { Severity } from './severity.ts';

export interface MongooseLintConfig {
  /** Globs to lint, relative to the config file. Defaults to the whole root. */
  readonly include?: readonly string[];
  /** Globs to skip, on top of the always-ignored ones (node_modules, dist, …). */
  readonly exclude?: readonly string[];
  /** Rule id → severity. Anything unlisted keeps the rule's own default. */
  readonly rules?: Readonly<Record<string, Severity>>;
}

/**
 * Identity function, for types and editor completion in `mongoose-lint.config.ts`:
 *
 * ```ts
 * import { defineConfig } from 'mongoose-lint';
 * export default defineConfig({ rules: { 'ref-without-index': 'warn' } });
 * ```
 */
export function defineConfig(config: MongooseLintConfig): MongooseLintConfig {
  return config;
}
