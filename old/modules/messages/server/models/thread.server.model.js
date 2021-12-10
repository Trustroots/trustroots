/**
 * Module dependencies.
 */
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate');
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
