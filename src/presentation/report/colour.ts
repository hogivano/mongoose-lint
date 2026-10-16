/**
 * Colour, in one place.
 *
 * Everything checks `isTTY` at call time rather than at import time, so piping
 * to a file or a CI log produces plain text — and so tests can assert on the
 * exact string without stripping escape codes.
 */

const enabled = (): boolean =>
  process.stdout.isTTY === true && process.env['NO_COLOR'] === undefined;

const wrap = (code: string) => (text: string) =>
  enabled() ? `\u001b[${code}m${text}\u001b[0m` : text;

export const bold = wrap('1');
export const dim = wrap('2');
export const red = wrap('31');
export const yellow = wrap('33');
