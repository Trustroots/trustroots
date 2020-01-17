/**
 * Module dependencies.
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Support request Schema
 *
 * This collection serves as a backup for sent support requests
 */
const SupportRequestSchema = new Schema({
  user: {
    type: Schema.ObjectId,
    ref: 'User',
  },
  sent: {
    type: Date,
    default: Date.now,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
  },
  username: {
    type: String,
  },
  message: {
    type: String,
    required: true,
  },
  userAgent: {
    type: String,
  },
  reportMember: {
    type: String,
  },
});

mongoose.model('SupportRequest', SupportRequestSchema);
