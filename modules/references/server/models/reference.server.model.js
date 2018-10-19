'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    uniqueValidation = require('mongoose-beautiful-unique-validation'),
    Schema = mongoose.Schema;

/**
 * ReferenceUser Schema
 */
var ReferenceSchema = new Schema({
  created: {
    type: Date,
    default: Date.now,
    required: true
  },
  /*
  modified: {
    type: Date,
    default: Date.now
  },
  */
  public: {
    type: Boolean,
    default: true,
    required: true
  },
  userFrom: {
    type: Schema.ObjectId,
    ref: 'User',
    required: true
  },
  userTo: {
    type: Schema.ObjectId,
    ref: 'User',
    required: true
  },
  met: {
    type: Boolean,
    default: false,
    required: true
  },
  hosted_me: {
    type: Boolean,
    default: false,
    required: true
  },
  hosted_them: {
    type: Boolean,
    default: false,
    required: true
  },
  recommend: {
    type: String,
    enum: ['yes', 'no', 'unknown'],
    default: 'unknown',
    required: true
  }/* ,
  feedbackPublic: {
    type: String,
    trim: true
  },
  feedbackPrivate: {
    type: String,
    trim: true
  }
  */
});

/**
 * Indexing
 */
ReferenceSchema.plugin(uniqueValidation);
ReferenceSchema.index({ userFrom: 1, userTo: 1, public: 1, created: 1 });
ReferenceSchema.index({ userFrom: 1, userTo: 1 }, { unique: true });

mongoose.model('Reference', ReferenceSchema);
