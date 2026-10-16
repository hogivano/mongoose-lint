import { Schema } from 'mongoose';

declare const isPromoAccount: () => boolean;

/**
 * Four unique paths. Two of them are the E11000 that shows up months after
 * launch, when the second document without the field is written.
 */
export const UserSchema = new Schema({
  // Violation: the second user without an email collides on { email: null }.
  email: { type: String, unique: true },

  // Violation, with a note: conditionally required is still sometimes absent.
  referralCode: { type: String, unique: true, required: isPromoAccount },

  // Violation on a nested path — reported as `profile.handle`.
  profile: {
    handle: { type: String, unique: true },
  },

  // Fine: required, so it is never null.
  username: { type: String, unique: true, required: true },
});
