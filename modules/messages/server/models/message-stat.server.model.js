'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

/**
 * MessageStat Schema
 */
var messageStatSchema = new Schema({
  // The id of the user who wrote the first message of the thread
  firstMessageUserFrom: {
    type: Schema.ObjectId,
    ref: 'User'
  },
  // The id of the user who received the first message of the thread
  firstMessageUserTo: {
    type: Schema.ObjectId,
    ref: 'User'
  },
  // The Date when the first message was sent
  firstMessageCreated: {
    type: Date
  },
  // The length of the first message
  firstMessageLength: {
    type: Number
  },
  // The Date when the reply was sent
  // The reply is the first message which was sent from firstMessageUserTo
  // to firstMessageUserFrom. It must have happened after the very first
  // message was sent.
  firstReplyCreated: {
    type: Date,
    default: null
  },
  // The length of the first reply
  firstReplyLength: {
    type: Number,
    default: null
  },
  // Number of milliseconds from the creation of the first message
  // (firstMessageCreated) till the creation of the first reply (firstReplyCreated)
  // In theory this could be removed. It is easily retrieved from the database
  timeToFirstReply: {
    type: Number,
    default: null
  }
});


// This index helps improve search for all the MessageStat documents when
// counting the MessageStat in users' profile
// Because we search stats of specific receiver of last 3 months
messageStatSchema.index({ firstMessageUserTo: 1, firstMessageCreated: -1 });

// This index helps search for a particular MessageStat document based on
// the sender and receiver ids
messageStatSchema.index({ firstMessageUserFrom: 1, firstMessageUserTo: -1 },
  { unique: true });

mongoose.model('MessageStat', messageStatSchema);
