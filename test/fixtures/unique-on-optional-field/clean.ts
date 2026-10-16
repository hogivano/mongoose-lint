import { Schema } from 'mongoose';

/**
 * Every correct way to have a unique optional field. This file must produce
 * zero findings — the test that matters more than the violating one.
 */
export const AccountSchema = new Schema({
  // Required, so the field is always present.
  email: { type: String, unique: true, required: true },

  // A partial index, filtered on $type so an explicit null is not indexed.
  slug: {
    type: String,
    unique: true,
    partialFilterExpression: { slug: { $type: 'string' } },
  },

  // sparse is the legacy equivalent and still correct.
  legacyId: { type: String, unique: true, sparse: true },

  // Not unique, so none of this applies.
  displayName: String,
  tags: [String],
});
