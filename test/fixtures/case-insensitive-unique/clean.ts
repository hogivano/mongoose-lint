import { Schema } from 'mongoose';

// Normalised on write.
export const LowercasedSchema = new Schema({
  email: { type: String, unique: true, required: true, lowercase: true },
});

// Compared case-insensitively at the index level, storing what was typed.
export const CollatedSchema = new Schema(
  {
    email: { type: String, unique: true, required: true },
  },
  { collation: { locale: 'en', strength: 2 } },
);

// Not a String, so case does not apply.
export const NumericSchema = new Schema({
  memberNumber: { type: Number, unique: true, required: true },
});
