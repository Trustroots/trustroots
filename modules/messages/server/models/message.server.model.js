'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    mongoosePaginate = require('mongoose-paginate'),
    Schema = mongoose.Schema;

/**
 * Message Schema
 */
var MessageSchema = new Schema({
  created: {
    type: Date,
    default: Date.now
  },
  content: {
    type: String,
    default: '',
    trim: true,
    required: 'Message cannot be blank'
  },
  userFrom: {
    type: Schema.ObjectId,
    ref: 'User'
  },
  userTo: {
    type: Schema.ObjectId,
    ref: 'User'
  },
  read: {
    type: Boolean,
    default: false
  },
  notified: {
    type: Boolean,
    default: false
  }
});

MessageSchema.plugin(mongoosePaginate);

mongoose.model('Message', MessageSchema);
