/**
 * The MongoDB pages the rules enforce.
 *
 * Every finding carries one. It is not decoration: it is what lets a
 * reviewer settle an argument about a finding without having to trust this
 * tool, and it is the reason the rules can be stated as MongoDB's rather than
 * as ours.
 */

export const DOCS = {
  antiPatterns: 'https://www.mongodb.com/docs/manual/data-modeling/design-antipatterns/',
  partialIndexes: 'https://www.mongodb.com/docs/manual/core/index-partial/',
  compoundIndexes: 'https://www.mongodb.com/docs/manual/core/index-compound/',
  singleFieldIndexes: 'https://www.mongodb.com/docs/manual/core/index-single/',
  collation: 'https://www.mongodb.com/docs/manual/reference/collation/',
  limits: 'https://www.mongodb.com/docs/manual/reference/limits/',
} as const;
