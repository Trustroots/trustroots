/**
 * Module dependencies.
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * MessageStat Schema
 */
const messageStatSchema = new Schema({
  // The id of the user who wrote the first message of the thread
  firstMessageUserFrom: {
    type: Schema.ObjectId,
    ref: 'User',
    index: true,
  },
  // The id of the user who received the first message of the thread
  firstMessageUserTo: {
    type: Schema.ObjectId,
    ref: 'User',
    index: true,
  },
  // The Date when the first message was sent
  firstMessageCreated: {
    type: Date,
    index: true,
  },
  // The length of the first message
  firstMessageLength: {
    type: Number,
  },
  // The Date when the reply was sent
  // The reply is the first message which was sent from firstMessageUserTo
  // to firstMessageUserFrom. It must have happened after the very first
  // message was sent.
  firstReplyCreated: {
    type: Date,
    default: null,
  },
  // The length of the first reply
  firstReplyLength: {
    type: Number,
    default: null,
  },
  // Number of milliseconds from the creation of the first message
  // (firstMessageCreated) till the creation of the first reply (firstReplyCreated)
  // In theory this could be removed. It is easily retrieved from the database
  timeToFirstReply: {
    type: Number,
    default: null,
  },
});

// ensure uniqueness of a MessageStat document per Thread (only in 1 direction)
messageStatSchema.index(
  { firstMessageUserFrom: 1, firstMessageUserTo: -1 },
  { unique: true },
);

mongoose.model('MessageStat', messageStatSchema);
