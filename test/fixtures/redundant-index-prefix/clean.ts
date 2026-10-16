import { Schema } from 'mongoose';

/**
 * The cases that break a naive prefix check. Zero findings expected.
 */
export const OrderSchema = new Schema({
  // A unique index is never redundant: the compound index below permits the
  // same email twice under different tenants.
  email: { type: String, unique: true, required: true },
  tenant: String,
  status: String,
  createdAt: Date,
});

OrderSchema.index({ email: 1, tenant: 1 });

// Order matters: { status: 1 } is not a prefix of { tenant: 1, status: 1 }.
OrderSchema.index({ status: 1 });
OrderSchema.index({ tenant: 1, status: 1 });

// Different leading key: neither covers the other.
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ tenant: 1, createdAt: -1 });
