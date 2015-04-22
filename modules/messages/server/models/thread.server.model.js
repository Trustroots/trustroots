'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
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
    ref: 'User'
  },
  userTo: {
    type: Schema.ObjectId,
    ref: 'User'
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

mongoose.model('Thread', ThreadSchema);
