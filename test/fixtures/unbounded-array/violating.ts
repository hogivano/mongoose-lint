import { Schema } from 'mongoose';

const { ObjectId } = Schema.Types;

export const ArticleSchema = new Schema({
  // Violation: comments grow with usage, towards the 16MB document limit.
  comments: [{ body: String, at: Date }],

  // Violation: an array of references grows the same way.
  subscribers: [{ type: ObjectId, ref: 'User' }],
});
