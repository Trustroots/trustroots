'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

/**
 * MessageStat Schema
 */
var MessageStatSchema = new Schema({
  firstMessageUserFrom: {
    type: Schema.ObjectId,
    ref: 'User'
  },
  firstMessageUserTo: {
    type: Schema.ObjectId,
    ref: 'User',
    index: true
  },
  firstMessageCreated: {
    type: Date,
    index: true
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
  // how long did it take the receiver of the first message to reply to it
  timeToFirstReply: {
    type: Number,
    default: null
  }
});

mongoose.model('MessageStat', MessageStatSchema);
