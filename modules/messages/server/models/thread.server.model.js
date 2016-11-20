'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    mongoosePaginate = require('mongoose-paginate'),
    Schema = mongoose.Schema;

/**
 * Thread Schema
 */
var ThreadSchema = new Schema({
  updated: {
    type: Date,
    default: Date.now
  },
  userFrom: {
    type: Schema.ObjectId,
    ref: 'User',
    index: true
  },
  userTo: {
    type: Schema.ObjectId,
    ref: 'User',
    index: true
  },
  // This points to the latest message inn this thread
  message: {
    type: Schema.ObjectId,
    ref: 'Message'
  },
  read: {
    type: Boolean,
    default: false
  }
});

// This index is useful when searching Threads by both userFrom and userTo
// Is probably not necessary thanks to Index Intersection
// https://docs.mongodb.com/manual/core/index-intersection/#index-intersection-and-compound-indexes
//
// ThreadSchema.index({ userFrom: 1, userTo: -1 });

ThreadSchema.plugin(mongoosePaginate);

mongoose.model('Thread', ThreadSchema);
