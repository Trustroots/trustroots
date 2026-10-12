import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate';
const service = {};

/**
 * Module dependencies.
 */
const Schema = mongoose.Schema;

/**
 * Thread Schema
 */
const ThreadSchema = new Schema({
  updated: {
    type: Date,
    default: Date.now,
  },
  userFrom: {
    type: Schema.ObjectId,
    ref: 'User',
    index: true,
  },
  userTo: {
    type: Schema.ObjectId,
    ref: 'User',
    index: true,
  },
  // This points to the latest message inn this thread
  message: {
    type: Schema.ObjectId,
    ref: 'Message',
  },
  read: {
    type: Boolean,
    default: false,
  },
});
ThreadSchema.plugin(mongoosePaginate);
mongoose.model('Thread', ThreadSchema);
export default service;
export { service as 'module.exports' };
