/**
 * MongoDB's six published schema design anti-patterns.
 *
 * Every rule that enforces one cites it: the point is that the rules
 * are MongoDB's, not ours. It moves the argument from "do I agree with this
 * linter" to "do I agree with MongoDB", which is a much better argument to be
 * on the other side of.
 *
 * Two of the six — bloated documents and data normalization — are only
 * partially visible from a schema definition, and one, massive number of
 * collections, needs a deployment view this tool does not have. They are listed
 * anyway so the gap is documented rather than silently absent.
 */

export const ANTI_PATTERN_INDEX =
  'https://www.mongodb.com/docs/manual/data-modeling/design-antipatterns/';

export type AntiPatternId =
  | 'unbounded-arrays'
  | 'bloated-documents'
  | 'unnecessary-indexes'
  | 'case-sensitivity'
  | 'data-normalization'
  | 'massive-number-of-collections';

export interface AntiPattern {
  readonly id: AntiPatternId;
  readonly title: string;
  /** Whether a rule can see it in a schema definition alone. */
  readonly detectable: 'yes' | 'partial' | 'no';
  readonly docs: string;
}

export const ANTI_PATTERNS: Readonly<Record<AntiPatternId, AntiPattern>> = {
  'unbounded-arrays': {
    id: 'unbounded-arrays',
    title: 'Unbounded arrays',
    detectable: 'yes',
    docs: ANTI_PATTERN_INDEX,
  },
  'bloated-documents': {
    id: 'bloated-documents',
    title: 'Bloated documents',
    detectable: 'partial',
    docs: ANTI_PATTERN_INDEX,
  },
  'unnecessary-indexes': {
    id: 'unnecessary-indexes',
    title: 'Unnecessary indexes',
    detectable: 'yes',
    docs: ANTI_PATTERN_INDEX,
  },
  'case-sensitivity': {
    id: 'case-sensitivity',
    title: 'Case sensitivity',
    detectable: 'yes',
    docs: ANTI_PATTERN_INDEX,
  },
  'data-normalization': {
    id: 'data-normalization',
    title: 'Data normalization',
    detectable: 'partial',
    docs: ANTI_PATTERN_INDEX,
  },
  'massive-number-of-collections': {
    id: 'massive-number-of-collections',
    title: 'Massive number of collections',
    detectable: 'no',
    docs: ANTI_PATTERN_INDEX,
  },
};
