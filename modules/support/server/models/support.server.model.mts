import mongoose, { type Types } from 'mongoose';
import supportCategories from '../../shared/categories.ts';

/**
 * Module dependencies.
 */
const Schema = mongoose.Schema;
const { SUPPORT_CATEGORIES } = supportCategories;

export interface SupportRequestRecord {
  category: keyof typeof SUPPORT_CATEGORIES;
  user?: Types.ObjectId;
  sent: Date;
  email?: string;
  username?: string;
  message: string;
  userAgent?: string;
  reportMember?: string;
  reportedUser?: Types.ObjectId;
  linkageEvidence?: string;
  status: 'open' | 'resolved';
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
}

/**
 * Support request Schema
 *
 * This collection serves as a backup for sent support requests
 */
const SupportRequestSchema = new Schema<SupportRequestRecord>({
  category: {
    type: String,
    enum: Object.keys(SUPPORT_CATEGORIES),
    default: 'other',
  },
  user: {
    type: Schema.Types.ObjectId,
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
  reportedUser: { type: Schema.Types.ObjectId, ref: 'User' },
  linkageEvidence: { type: String },
  status: { type: String, enum: ['open', 'resolved'], default: 'open' },
  resolvedAt: { type: Date },
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
});
SupportRequestSchema.index({ status: 1, sent: -1 });
mongoose.model('SupportRequest', SupportRequestSchema);
const defaultInterop = {};
export default defaultInterop;
export { defaultInterop as 'module.exports' };
