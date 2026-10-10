import mongoose from 'mongoose';
import supportCategories from '../../shared/categories.js';

/**
 * Module dependencies.
 */
const Schema = mongoose.Schema;
const { SUPPORT_CATEGORIES } = supportCategories;

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
  reportedUser: { type: Schema.ObjectId, ref: 'User' },
  linkageEvidence: { type: String },
  status: { type: String, enum: ['open', 'resolved'], default: 'open' },
  resolvedAt: { type: Date },
  resolvedBy: { type: Schema.ObjectId, ref: 'User' },
});
SupportRequestSchema.index({ status: 1, sent: -1 });
mongoose.model('SupportRequest', SupportRequestSchema);
const defaultInterop = {};
export default defaultInterop;
export { defaultInterop as 'module.exports' };
