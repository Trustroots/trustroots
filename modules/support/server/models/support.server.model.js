/**
 * Module dependencies.
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { SUPPORT_CATEGORIES } = require('../../shared/categories');

/**
 * Support request Schema
 *
 * This collection serves as a backup for sent support requests
 */
const SupportRequestSchema = new Schema({
  category: {
    type: String,
    enum: Object.keys(SUPPORT_CATEGORIES),
    default: 'other',
  },
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
