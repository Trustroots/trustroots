'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

/**
 * ThreadStat Schema
 */
var ThreadStatSchema = new Schema({
  thread: {
    type: Schema.ObjectId,
    ref: 'Thread',
    unique: true
  },
  firstMessageUserFrom: {
    type: Schema.ObjectId,
    ref: 'User'
  },
  firstMessageUserTo: {
    type: Schema.ObjectId,
    ref: 'User'
  },
  firstMessageCreated: {
    type: Date
  },
  firstMessageLength: {
    type: Number
  },
  firstReplyCreated: {
    type: Date,
    default: null
  },
  firstReplyLength: {
    type: Number,
    default: null
  },
  firstReplyTime: {
    type: Number,
    default: null
  }
});

mongoose.model('ThreadStat', ThreadStatSchema);
