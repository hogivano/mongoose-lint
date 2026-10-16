/**
 * Formatting helpers for the `fix:` line.
 *
 * A suggested fix that cannot be pasted into the file is worse than no
 * suggestion, so a nested path is quoted the way MongoDB requires it:
 * `{ 'profile.handle': { $type: 'string' } }`.
 */

export function pathKey(name: string): string {
  return name.includes('.') ? `'${name}'` : name;
}
