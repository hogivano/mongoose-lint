/** Errors the CLI knows how to print. Anything else is a bug and gets a stack. */

export class LintError extends Error {
  /** Extra lines printed under the message — say what to do, not just what broke. */
  readonly hint?: string;

  constructor(message: string, hint?: string) {
    super(message);
    this.name = new.target.name;
    if (hint !== undefined) this.hint = hint;
  }
}

/** Bad flags or arguments. */
export class UsageError extends LintError {}

/** Nothing to lint, or a root that does not exist. */
export class NoSourceFilesError extends LintError {}

/** A config file that exists but could not be loaded or does not typecheck. */
export class ConfigError extends LintError {}

/** `--rule no-such-rule=error`, or a config naming a rule that does not exist. */
export class UnknownRuleError extends LintError {}
