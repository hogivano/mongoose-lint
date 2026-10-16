/**
 * Help text.
 *
 * It leads with what the tool refuses to do — no database, no import of your
 * code, no rule that is not MongoDB's — because those are the first three
 * questions anyone has about a linter they are being asked to put in CI.
 */

import { createRuleRegistry } from '../../infrastructure/rules/registry.ts';
import { bold, dim } from '../report/colour.ts';

export function help(): string {
  const rules = createRuleRegistry().all();
  const on = rules.filter((rule) => rule.meta.defaultSeverity !== 'off').length;

  return `${bold('mongoose-lint')} — MongoDB schema design anti-patterns, caught in CI

${bold('USAGE')}
  mongoose-lint [command] [path] [options]

  <path> is the directory to lint  ${dim('(default: the working directory)')}

${bold('COMMANDS')}
  lint    Check the schemas under <path>. The default.
  rules   Show every rule, its severity, and what it enforces.

${bold('HOW IT WORKS')}
  Static analysis of your schema source. It never imports Mongoose, never
  connects to a database, and never runs your code — so it works on Mongoose 5
  through 9, in CI, on a repo whose dependencies are not installed.

  A schema built dynamically cannot be resolved statically. Those are reported
  as UNRESOLVED with a file and line, never silently skipped: a linter that
  claims a clean run on half a codebase is worse than no linter.

${bold('RULES')}
  ${on} of ${rules.length} rules are on by default — the deterministic ones.
  The rest are off until you decide they apply to your schemas.
  ${dim('mongoose-lint rules --verbose')}

${bold('OPTIONS')}
  --rule <id>=<severity>  error | warn | off, for one run. Repeatable.
  --only <id,...>         Run only these rules.
  --config <file>         Config file  ${dim('(default: nearest mongoose-lint.config.*)')}
  --ignore <glob>         Skip paths. Repeatable.
  --strict                Warnings and UNRESOLVED schemas also fail.
  --all                   List every finding, not the first few per schema.
  --verbose               rules only: print each rule's full explanation.
  --json                  Machine-readable output.
  -h, --help              Show this help.
  -v, --version           Print the version.

${bold('EXIT CODES')}
  0  clean
  1  findings  ${dim('— errors, or anything at all under --strict')}
  2  error

${bold('SUPPRESSING A FINDING')}
  // mongoose-lint-disable-next-line unique-on-optional-field
  // mongoose-lint-disable-file redundant-index-prefix

  Suppressions are counted in the report, so a clean run that rests on forty
  disable comments still says so.

${bold('EXAMPLES')}
  ${dim('# the common case')}
  npx mongoose-lint ./src

  ${dim('# in CI, with the heuristics on and everything failing the build')}
  npx mongoose-lint ./src --rule unbounded-array=warn --strict

  ${dim('# what would this rule say, before turning it on for everyone?')}
  npx mongoose-lint ./src --only ref-without-index --rule ref-without-index=warn

${dim('https://github.com/hogivano/mongoose-lint')}`;
}
