# mongoose-lint

> MongoDB documents six schema design anti-patterns. Your ORM doesn't check for
> any of them.

```
$ npx mongoose-lint ./src

  models/user.ts  UserSchema

    error  models/user.ts:14:3  "email" is unique but not required — the second document without it throws E11000
           unique-on-optional-field
           fix: { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
```

Static analysis — no database, no Mongoose import, works on Mongoose 5 through 9.

## Install

```bash
npm install --save-dev mongoose-lint
npx mongoose-lint ./src
```

Node 20+. The only dependency is `ts-morph`.

## Why this exists

The rules are not opinions. MongoDB publishes them, and every finding links to
the page it enforces — so a disagreement about a finding is a disagreement with
MongoDB's documentation, not with this tool.

| MongoDB anti-pattern | Detectable from a schema? | Rule |
|---|---|---|
| Unbounded arrays | heuristic | `unbounded-array` |
| Unnecessary indexes | yes | `redundant-index-prefix` |
| Case sensitivity | yes | `case-insensitive-unique` |
| Data normalization | partial | `ref-without-index` |
| Bloated documents | partial | — |
| Massive number of collections | no — needs a deployment view | — |

Plus the one that is not in MongoDB's list but costs the most in practice:
`unique: true` on a field that is not required.

## Static analysis, and what it costs

The alternative is to import your schema at runtime and read `schema.paths`.
That is easier, and it means executing your code — your connection config, your
env vars, your side effects — and inheriting the whole Mongoose 5→9
compatibility matrix.

This tool parses your schema *source* instead. It never imports Mongoose, never
connects to anything, and runs in CI on a repo whose dependencies are not
installed.

The honest cost: a schema built dynamically — a spread, a factory, a variable —
cannot be resolved statically. Those are **reported**, with a file and a line:

```
  UNRESOLVED (3)  — read, but not understood. Not checked.

    models/invoice.ts:9:3   spread in a schema definition
      ...auditFields
    models/invoice.ts:11:3  path "email" is not a literal definition
      email: emailField
```

A linter that silently skips half a codebase while claiming a clean run is
worse than no linter. `--strict` makes those fail the build too.

## The rules

`mongoose-lint rules --verbose` prints all of this with its reasoning.

### `unique-on-optional-field` · error, on by default

A unique index treats a missing field as `null`, so the *second* document
without the field collides with the first:

```
E11000 duplicate key error ... { email: null }
```

It never happens in development, where only one such document exists. It
happens months after launch.

```js
// the bug
email: { type: String, unique: true }

// the fix
email: {
  type: String,
  unique: true,
  partialFilterExpression: { email: { $type: 'string' } },
}
```

Use `$type` rather than `$exists` if the application ever writes a literal
`null` — an explicit null satisfies `$exists: true` and still collides. That
case has its own rule, `unique-partial-filter-exists`, off by default.

### `redundant-index-prefix` · error, on by default

`{ tenant: 1 }` declared alongside `{ tenant: 1, createdAt: -1 }` is served
twice. The narrower index costs write throughput and RAM and buys nothing.

Safe to ship as an error because it advises *dropping* an index — advice that
costs nothing if taken and nothing if ignored. Order matters: `{ status: 1 }`
is **not** covered by `{ tenant: 1, status: 1 }`. An index that enforces
something of its own — unique, a partial filter, sparse, a TTL, a collation —
is never reported.

### `case-insensitive-unique` · off by default

A unique `String` path with no `lowercase: true` and no collation:
`Bob@example.com` and `bob@example.com` both register. Off by default because a
slug, an API key or an external id is *meant* to be case sensitive.

### `ref-without-index` · off by default

A `ref` path with no index makes every query that filters on it a collection
scan.

One correction to the folklore, which this project's own plan got wrong:
`post.populate('author')` is **not** the expensive direction — that queries
`_id` on the referenced collection, which is always indexed. The cost lands on
the reverse lookup, `Post.find({ author: userId })`, and on virtual populate,
which queries `foreignField`.

Off by default: this rule advises *adding* an index, which costs write
throughput, and whether the reverse query happens at all is a fact about your
application.

### `unbounded-array` · heuristic, off by default

An array of subdocuments or references that grows with usage runs into the 16MB
document limit. You cannot statically prove an array is unbounded, so the
heuristic is narrowed until what is left is defensible: only arrays of
subdocuments or refs, never arrays of primitives, and never when the schema
declares a cap.

It is off by default, it can never be an error, and if it is noisy on your
schemas the answer is to turn it off rather than argue with it.

## False positives are the only thing that matters

A linter lives or dies on this. The failure mode is not a missed bug — it is one
bad warning, someone adds a disable comment, and the tool is dead.

So:

- Only the two deterministic rules are on by default
- A heuristic rule can never be an error and can never default to on — enforced
  in the registry, not by review
- An option this tool cannot read is `unresolved`, never assumed `false`
- Every finding links to the MongoDB page it enforces
- Every rule ships with a `violating` and a `clean` fixture, and the clean one
  producing zero findings is the more important test

## Validated on a real codebase

The rules were run against a large production Node.js codebase before
publishing, which is the only acceptance test that means anything: a linter you
do not trust on your own repo is one nobody should trust on theirs.

```
58,812 files · 1,159 schemas · 17s
131 errors · 49 UNRESOLVED
  116  redundant-index-prefix
   15  unique-on-optional-field
```

Findings were sampled and confirmed by hand. One of them turned out to be a
typo — `require: true` instead of `required: true`, which Mongoose ignores
silently, leaving a unique field optional and one duplicate away from E11000.

Two bugs in this tool were found by that run and fixed: ignore globs that
matched nothing against absolute paths (so `node_modules` was being read), and
a constructor matcher that missed `const Schema = mongoose.Schema` — the most
common idiom in Mongoose model files, and one that would have made this tool
report a clean run on most of that codebase.

## Configuration

`mongoose-lint.config.ts` (or `.mjs`, or `.json`), found by walking up from the
linted directory:

```ts
import { defineConfig } from 'mongoose-lint';

export default defineConfig({
  include: ['src/**/*.ts'],
  rules: {
    'ref-without-index': 'warn',
    'unbounded-array': 'off',
  },
});
```

A rule id that does not exist is an error, not a silent no-op.

### Suppressing one finding

```js
// mongoose-lint-disable-next-line unique-on-optional-field
token: { type: String, unique: true },
```

`mongoose-lint-disable-file <rule-id>` covers a whole file. Suppressions are
counted in the report, so a clean run that rests on forty disable comments
still says so.

## CLI

```
mongoose-lint [lint|rules] [path] [options]

  --rule <id>=<severity>  error | warn | off, for one run. Repeatable.
  --only <id,...>         Run only these rules.
  --config <file>         Config file (default: nearest mongoose-lint.config.*)
  --ignore <glob>         Skip paths. Repeatable.
  --strict                Warnings and UNRESOLVED schemas also fail.
  --all                   List every finding, not the first few per schema.
  --json                  Machine-readable output.
```

Exit codes: `0` clean · `1` findings · `2` error. Only `error`-severity findings
fail the run; a tool that fails a build over a heuristic gets removed from the
build.

### In CI

```yaml
- run: npx mongoose-lint ./src --strict
```

## As a library

```ts
import {
  createCodebase,
  createSchemaReader,
  createRuleRegistry,
  createSystemClock,
  lint,
} from 'mongoose-lint';

const codebase = createCodebase({ root: './src' });
const report = lint({
  codebase,
  reader: createSchemaReader(codebase),
  registry: createRuleRegistry(),
  clock: createSystemClock(),
});
```

Individual rules are exported too, and every rule is a pure function from a
resolved `SchemaModel` to matches — so writing one, or testing one, needs no
AST and no file system.

## Architecture

```
src/
  domain/          plain data and pure functions. No I/O, no ts-morph, no deps.
    schema.ts      the resolved schema model every rule reads
    value.ts       a literal, or an honest `unresolved`
    finding.ts     report.ts  severity.ts  exit-code.ts  config.ts

  application/     use cases, and the ports they need from the outside world
    rule.ts        the rule contract: SchemaModel -> RuleMatch[]
    use-cases/     lint.ts  list-rules.ts

  infrastructure/  the only place ts-morph exists
    schema/        the parser: schema-calls, paths, indexes, values, directives
    rules/         one file per rule, one anti-pattern each
    codebase/  config/

  presentation/
    cli/           args, help, and the composition root
    report/        human, json, rules
```

The parser is the layer everything else depends on. It is the only place
allowed to decide that something cannot be read — which it records rather than
skips.

## Related

- [`aggregate-explain`](https://github.com/hogivano/aggregate-explain) — the
  runtime half: explains a slow aggregation once it is slow.
  `mongoose-lint` catches it at design time; `aggregate-explain` explains it at
  runtime.
- [`mongoose-codemod`](https://github.com/hogivano/mongoose-codemod) — what a
  Mongoose upgrade breaks, and which half is safe to automate.
- [`searchdex`](https://github.com/hogivano/searchdex) — Atlas Search index
  management.

## Not in scope

Runtime performance, index management or deployment, version upgrades, query
analysis, and **auto-fixing**. Schema changes need migrations and human
judgement; this tool reports and stops.

## Development

```bash
npm install
npm test          # node --test, no framework
npm run typecheck
npm run dev -- ./some/models    # run the CLI from source
```

Every rule needs a fixture pair in `test/fixtures/<rule-id>/`: `violating.ts`
and `clean.ts`. The clean one must produce zero findings.

## License

MIT
