import { Schema } from 'mongoose';

const { ObjectId } = Schema.Types;

export const PostSchema = new Schema({
  // Violation: Post.find({ author: userId }) scans the collection.
  author: { type: ObjectId, ref: 'User' },
  title: String,
});
