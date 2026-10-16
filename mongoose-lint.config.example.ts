/**
 * Copy this to `mongoose-lint.config.ts` and delete what you disagree with.
 *
 * Named `.example.ts` on purpose: a config is a set of decisions about your
 * schemas, and a default one shipped in the package would be this tool making
 * those decisions for you.
 */

import { defineConfig } from 'mongoose-lint';

export default defineConfig({
  // Where your schemas are. Narrower globs are faster and quieter.
  include: ['src/**/*.ts'],
  exclude: ['**/*.spec.ts'],

  rules: {
    // On by default — deterministic, and the reason the tool exists.
    'unique-on-optional-field': 'error',
    'redundant-index-prefix': 'error',

    // Off by default. Turn one on, read what it says about your schemas, and
    // decide whether you agree before it goes in CI for everyone.
    'case-insensitive-unique': 'warn',
    'ref-without-index': 'off',
    'unique-partial-filter-exists': 'off',

    // Heuristic. It cannot tell a comments array from an address array.
    'unbounded-array': 'off',
  },
});
