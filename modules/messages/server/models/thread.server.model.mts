import mongoose, { type Types } from 'mongoose';
import mongoosePaginate from '../../../../config/lib/mongoose-paginate.mjs';
const service = {};

export interface ThreadRecord {
  updated?: Date;
  userFrom?: Types.ObjectId;
  userTo?: Types.ObjectId;
  message?: Types.ObjectId;
  read?: boolean;
}

/**
 * Module dependencies.
 */
const Schema = mongoose.Schema;

/**
 * Thread Schema
 */
const ThreadSchema = new Schema<ThreadRecord>({
  updated: {
    type: Date,
    default: Date.now,
  },
  userFrom: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  userTo: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  // This points to the latest message inn this thread
  message: {
    type: Schema.Types.ObjectId,
    ref: 'Message',
  },
  read: {
    type: Boolean,
    default: false,
  },
});
ThreadSchema.plugin(mongoosePaginate);
mongoose.model<ThreadRecord>('Thread', ThreadSchema);
export default service;
export { service as 'module.exports' };
