import mongoose, { type Types } from 'mongoose';

export interface SupportAttachment {
  filename?: string;
  contentType?: string;
  size?: number;
}

export interface SupportMessageRecord {
  request: Types.ObjectId;
  direction: 'inbound' | 'outbound';
  kind: 'reply' | 'acknowledgement';
  body: string;
  createdAt: Date;
  authorId?: Types.ObjectId;
  authorName?: string;
  emailFrom?: string;
  emailTo?: string;
  messageId: string;
  inReplyTo?: string;
  references?: string[];
  idempotencyKey?: string;
  idempotencyKeys?: string[];
  inboundKey?: string;
  deliveryState:
    | 'received'
    | 'queued'
    | 'sending'
    | 'accepted'
    | 'captured'
    | 'failed'
    | 'uncertain';
  attempts: number;
  lastAttemptAt?: Date;
  acceptedAt?: Date;
  errorCode?: string;
  attachments?: SupportAttachment[];
  oversized?: boolean;
  truncated?: boolean;
  requestRevision?: number;
  requestActivityAt?: Date | null;
  activityAppliedAt?: Date;
}

const { Schema } = mongoose;
const SupportMessageSchema = new Schema<SupportMessageRecord>({
  request: {
    type: Schema.Types.ObjectId,
    ref: 'SupportRequest',
    required: true,
  },
  direction: { type: String, enum: ['inbound', 'outbound'], required: true },
  kind: { type: String, enum: ['reply', 'acknowledgement'], default: 'reply' },
  body: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  authorId: { type: Schema.Types.ObjectId, ref: 'User' },
  authorName: String,
  emailFrom: String,
  emailTo: String,
  messageId: { type: String, required: true },
  inReplyTo: String,
  references: [String],
  idempotencyKey: String,
  idempotencyKeys: { type: [String], default: undefined },
  inboundKey: String,
  deliveryState: {
    type: String,
    enum: [
      'received',
      'queued',
      'sending',
      'accepted',
      'captured',
      'failed',
      'uncertain',
    ],
    required: true,
  },
  attempts: { type: Number, default: 0 },
  lastAttemptAt: Date,
  acceptedAt: Date,
  errorCode: String,
  attachments: [{ filename: String, contentType: String, size: Number }],
  oversized: { type: Boolean, default: false },
  truncated: { type: Boolean, default: false },
  requestRevision: Number,
  requestActivityAt: Date,
  activityAppliedAt: Date,
});
SupportMessageSchema.index({ request: 1, createdAt: 1, _id: 1 });
SupportMessageSchema.index(
  { request: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  },
);
SupportMessageSchema.index(
  { request: 1, idempotencyKeys: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKeys: { $type: 'array' } },
  },
);
SupportMessageSchema.index({ inboundKey: 1 }, { unique: true, sparse: true });
SupportMessageSchema.index({ messageId: 1 }, { unique: true });
SupportMessageSchema.index({ deliveryState: 1, createdAt: 1 });
mongoose.model<SupportMessageRecord>('SupportMessage', SupportMessageSchema);
const defaultInterop = {};
export default defaultInterop;
export { defaultInterop as 'module.exports' };
