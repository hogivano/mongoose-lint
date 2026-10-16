import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveSeverities } from '../../src/application/index.ts';
import { UnknownRuleError } from '../../src/domain/index.ts';
import { createRuleRegistry } from '../../src/infrastructure/rules/registry.ts';

const registry = createRuleRegistry();
const severityOf = (resolved: ReturnType<typeof resolveSeverities>, id: string) =>
  resolved.find((entry) => entry.rule.meta.id === id)?.severity;

describe('severity resolution', () => {
  it('ships two deterministic rules on and the rest off', () => {
    const resolved = resolveSeverities(registry);

    assert.equal(severityOf(resolved, 'unique-on-optional-field'), 'error');
    assert.equal(severityOf(resolved, 'redundant-index-prefix'), 'error');
    assert.equal(severityOf(resolved, 'unbounded-array'), 'off');
    assert.equal(severityOf(resolved, 'ref-without-index'), 'off');
  });

  it('lets the config file turn a rule on', () => {
    const resolved = resolveSeverities(registry, { config: { 'ref-without-index': 'warn' } });
    assert.equal(severityOf(resolved, 'ref-without-index'), 'warn');
  });

  it('lets the command line override the config file', () => {
    const resolved = resolveSeverities(registry, {
      config: { 'ref-without-index': 'warn' },
      cli: { 'ref-without-index': 'off' },
    });
    assert.equal(severityOf(resolved, 'ref-without-index'), 'off');
  });

  it('--only switches everything else off, whatever the config says', () => {
    const resolved = resolveSeverities(registry, {
      config: { 'ref-without-index': 'error' },
      only: ['unique-on-optional-field'],
    });

    assert.equal(severityOf(resolved, 'unique-on-optional-field'), 'error');
    assert.equal(severityOf(resolved, 'ref-without-index'), 'off');
  });

  it('rejects an unknown rule id rather than silently doing nothing', () => {
    assert.throws(
      () => resolveSeverities(registry, { config: { 'unique-on-optional': 'error' } }),
      UnknownRuleError,
    );
  });
});
