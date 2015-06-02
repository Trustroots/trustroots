'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

/**
 * Contact Schema
 */
var ContactSchema = new Schema({
  created: {
    type: Date,
    default: Date.now
  },
  confirmed: {
    type: Boolean,
    default: false
  },
  users: {
    type: [{
      type: Schema.ObjectId,
      ref: 'User'
    }],
    required: 'Missing users!',
    default: []
  }
});

mongoose.model('Contact', ContactSchema);
