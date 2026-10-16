/** Turning a rule match into a Finding: the one place the two models meet. */

import type { Finding, SchemaModel, Severity } from '../domain/index.ts';
import type { Rule, RuleMatch } from './rule.ts';

export function toFinding(
  rule: Rule,
  match: RuleMatch,
  schema: SchemaModel,
  severity: Exclude<Severity, 'off'>,
): Finding {
  return {
    ruleId: rule.meta.id,
    severity,
    title: rule.meta.title,
    ...(rule.meta.antiPattern === undefined ? {} : { antiPattern: rule.meta.antiPattern }),
    docs: rule.meta.docs,
    location: match.location,
    schema: schema.name,
    subject: match.subject,
    message: match.message,
    ...(match.fix === undefined ? {} : { fix: match.fix }),
    ...(match.note === undefined ? {} : { note: match.note }),
  };
}
