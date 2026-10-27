import mongoose, { type Types } from 'mongoose';
import supportCategories from '../../shared/categories.ts';
import { SUPPORT_STATUSES, type SupportStatus } from '../../shared/statuses.ts';

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
  status: SupportStatus | 'resolved';
  subject?: string;
  lastActivityAt?: Date;
  statusChangedAt?: Date;
  statusRevision: number;
  zendeskTicketId?: number;
  initialMessageId?: string;
  initialInboundKey?: string;
  initialReferences?: string[];
  initialAttachments?: Array<{
    filename?: string;
    contentType?: string;
    size?: number;
  }>;
  oversized?: boolean;
  truncated?: boolean;
  resolvedAt?: Date | null;
  resolvedBy?: Types.ObjectId | null;
}

/**
 * Support request Schema
 *
 * Shared support requests and their original requester messages.
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
  status: {
    type: String,
    enum: [...SUPPORT_STATUSES, 'resolved'],
    default: 'new',
  },
  subject: { type: String, maxlength: 998 },
  lastActivityAt: { type: Date },
  statusChangedAt: { type: Date },
  statusRevision: { type: Number, default: 0 },
  zendeskTicketId: { type: Number },
  initialMessageId: { type: String },
  initialInboundKey: { type: String },
  initialReferences: [{ type: String }],
  initialAttachments: [{ filename: String, contentType: String, size: Number }],
  oversized: { type: Boolean, default: false },
  truncated: { type: Boolean, default: false },
  resolvedAt: { type: Date },
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
});
SupportRequestSchema.index({ status: 1, sent: -1 });
SupportRequestSchema.index({ lastActivityAt: -1, sent: -1 });
SupportRequestSchema.index({ initialMessageId: 1 }, { sparse: true });
SupportRequestSchema.index(
  { initialInboundKey: 1 },
  { unique: true, sparse: true },
);
SupportRequestSchema.index(
  { zendeskTicketId: 1 },
  { unique: true, sparse: true },
);
mongoose.model('SupportRequest', SupportRequestSchema);
const defaultInterop = {};
export default defaultInterop;
export { defaultInterop as 'module.exports' };
