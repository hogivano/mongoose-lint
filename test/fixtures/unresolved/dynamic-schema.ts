import { Schema } from 'mongoose';

declare const auditFields: Record<string, unknown>;
declare const emailField: Record<string, unknown>;
declare const buildDefinition: () => Record<string, unknown>;

/** A spread hides keys, so the options of this schema are only half known. */
export const InvoiceSchema = new Schema({
  ...auditFields,
  number: { type: String, unique: true, required: true },
  email: emailField,
});

/** Nothing at all can be said about this one. */
export const LedgerSchema = new Schema(buildDefinition());
