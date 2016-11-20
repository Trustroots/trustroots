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
    ref: 'User',
    index: true
  },
  userTo: {
    type: Schema.ObjectId,
    ref: 'User',
    index: true
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

// This index is useful when searching Messages by both userFrom and userTo
// Is probably not necessary thanks to Index Intersection
// https://docs.mongodb.com/manual/core/index-intersection/#index-intersection-and-compound-indexes
//
// MessageSchema.index({ userFrom: 1, userTo: -1 });

MessageSchema.plugin(mongoosePaginate);

mongoose.model('Message', MessageSchema);
