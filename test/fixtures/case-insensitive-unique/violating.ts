import { Schema } from 'mongoose';

export const MemberSchema = new Schema({
  // Violation: Bob@example.com and bob@example.com both register.
  email: { type: String, unique: true, required: true },
});
