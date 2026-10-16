import { Schema } from 'mongoose';

export const TokenSchema = new Schema({
  // mongoose-lint-disable-next-line unique-on-optional-field
  value: { type: String, unique: true },

  // Not suppressed: the directive above covers one line and one rule.
  handle: { type: String, unique: true },
});
