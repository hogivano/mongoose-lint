import { Schema } from 'mongoose';

const { ObjectId } = Schema.Types;

export const CommentSchema = new Schema({
  // Indexed on the path.
  author: { type: ObjectId, ref: 'User', index: true },

  // Served by a compound index led by this path.
  post: { type: ObjectId, ref: 'Post' },

  // Unique implies an index.
  ticket: { type: ObjectId, ref: 'Ticket', unique: true, required: true },

  createdAt: Date,
});

CommentSchema.index({ post: 1, createdAt: -1 });
