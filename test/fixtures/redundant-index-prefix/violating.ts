import { Schema } from 'mongoose';

export const EventSchema = new Schema({
  // Violation: the compound index below already serves { tenant: 1 }.
  tenant: { type: String, index: true },
  createdAt: Date,
  kind: String,
});

EventSchema.index({ tenant: 1, createdAt: -1 });

// Violation: a hand-written index that is a prefix of the next one.
EventSchema.index({ kind: 1 });
EventSchema.index({ kind: 1, createdAt: -1 });
