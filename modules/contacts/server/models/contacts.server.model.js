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
  userFrom: {
    type: Schema.ObjectId,
    ref: 'User',
    required: 'Missing user!'
  },
  userTo: {
    type: Schema.ObjectId,
    ref: 'User',
    required: 'Missing user!'
  }
});

ContactSchema.index({ userFrom: 1 });
ContactSchema.index({ userTo: 1 });
ContactSchema.index({ confirmed: 1 });

mongoose.model('Contact', ContactSchema);
