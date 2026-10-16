import { Schema } from 'mongoose';

export const ProductSchema = new Schema({
  // An array of primitives is not what this rule is about.
  tags: [String],
  sizes: [Number],

  // A declared bound: someone has already thought about how big this gets.
  variants: {
    type: [{ sku: String, price: Number }],
    validate: (items: unknown[]) => items.length <= 50,
  },
});
