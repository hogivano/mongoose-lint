/**
 * Rule severity, and the one rule about it: only `error` fails the build.
 *
 * A linter with no brand behind it gets exactly one chance. A warning that
 * turns out to be wrong costs a shrug; an error that turns out to be wrong
 * gets the tool deleted from CI. So heuristic rules can never be
 * more than a warning, and are off by default besides.
 */

export type Severity = 'error' | 'warn' | 'off';

export const SEVERITIES: readonly Severity[] = ['error', 'warn', 'off'];

export function isSeverity(value: string): value is Severity {
  return (SEVERITIES as readonly string[]).includes(value);
}

/** Sorts errors before warnings in reports. */
export function severityRank(severity: Severity): number {
  return severity === 'error' ? 0 : severity === 'warn' ? 1 : 2;
}
