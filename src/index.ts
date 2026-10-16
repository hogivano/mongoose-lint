/**
 * Library entry point.
 *
 * Exported layer by layer, so an importer can see the architecture from the
 * export list: the domain is pure data and pure functions, the application
 * depends only on the domain and its own ports, and the infrastructure is the
 * only place ts-morph exists.
 *
 * The rules are exported individually because that is how they are meant to be
 * read — one file, one anti-pattern, one explanation you can disagree with.
 */

export * from './domain/index.ts';
export * from './application/index.ts';

export { createCodebase } from './infrastructure/codebase/ts-morph-codebase.ts';
export { createSchemaReader } from './infrastructure/schema/ts-morph-schema-reader.ts';
export { loadConfig } from './infrastructure/config/load-config.ts';
export { createSystemClock } from './infrastructure/system-clock.ts';
export { ALL_RULES, createRuleRegistry } from './infrastructure/rules/registry.ts';

export { uniqueOnOptionalField } from './infrastructure/rules/unique-on-optional-field.ts';
export { uniquePartialFilterExists } from './infrastructure/rules/unique-partial-filter-exists.ts';
export { redundantIndexPrefix } from './infrastructure/rules/redundant-index-prefix.ts';
export { caseInsensitiveUnique } from './infrastructure/rules/case-insensitive-unique.ts';
export { refWithoutIndex } from './infrastructure/rules/ref-without-index.ts';
export { unboundedArray } from './infrastructure/rules/unbounded-array.ts';

export { formatReport } from './presentation/report/human.ts';
export { formatRules } from './presentation/report/rules.ts';
export { reportToJson, rulesToJson } from './presentation/report/json.ts';
