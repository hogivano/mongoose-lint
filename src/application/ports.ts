/**
 * Ports: what the use cases need from the outside world, stated as interfaces.
 * Adapters live in src/infrastructure and are wired in src/presentation/cli.
 *
 * The important one is `SchemaReaderPort`. Rules never see an AST — they see
 * the resolved `SchemaModel` this port produces, and everything depends on
 * this being honest. One parser, one place where guessing is refused, and
 * every rule below it is a pure function that can be tested with a literal.
 */

import type {
  DisableDirective,
  MongooseLintConfig,
  SchemaModel,
  UnresolvedSite,
} from '../domain/index.ts';
import type { Rule } from './rule.ts';

/** The set of files under consideration. Read-only: this tool never writes. */
export interface CodebasePort {
  /** Absolute path the run was rooted at. */
  readonly root: string;
  /** How many files are in scope, for the report header. */
  readonly fileCount: number;
}

export interface SchemaRead {
  readonly schemas: readonly SchemaModel[];
  /**
   * Sites where a schema could not be built at all — `new Schema(definition)`
   * with a variable, a factory function, a spread at the top level. Sites
   * inside a schema that was otherwise readable live on that schema instead.
   */
  readonly unresolved: readonly UnresolvedSite[];
  readonly directives: readonly DisableDirective[];
}

/** Source files in, resolved schema models out. The only AST-aware seam. */
export interface SchemaReaderPort {
  read(): SchemaRead;
}

export interface RuleRegistryPort {
  all(): readonly Rule[];
  get(ruleId: string): Rule | undefined;
  has(ruleId: string): boolean;
}

/** Where the config came from, so `--config` failures name a real file. */
export interface ConfigPort {
  readonly config: MongooseLintConfig;
  /** Absolute path, or undefined when no config file was found. */
  readonly path?: string;
}

/** Injected so reports are deterministic under test. */
export interface ClockPort {
  now(): Date;
  /** Monotonic milliseconds, for durations. */
  elapsedMs(): number;
}
