import mongoose, { type Types } from 'mongoose';
import mongoosePaginate from '../../../../config/lib/mongoose-paginate.mjs';
import type { HostingDetails } from '../../shared/messages.js';
const service = {};

export interface MessageRecord {
  created?: Date;
  content?: string;
  userFrom?: Types.ObjectId;
  userTo?: Types.ObjectId;
  locationCorrectionKey?: string;
  locationCorrectionOffers?: Array<{
    offer?: Types.ObjectId;
    location?: number[];
  }>;
  read?: boolean;
  spam?: boolean;
  shadowHidden?: boolean;
  notificationCount?: number;
  hostingDetails?: HostingDetails;
}

/**
 * Module dependencies.
 */
const Schema = mongoose.Schema;

/**
 * Message Schema
 */
const MessageSchema = new Schema<MessageRecord>({
  created: {
    type: Date,
    default: Date.now,
  },
  content: {
    type: String,
    default: '',
    trim: true,
    // Preserve the legacy string option passed to Mongoose's required setter.
    required: 'Message cannot be blank' as unknown as boolean,
  },
  hostingDetails: {
    type: new Schema<HostingDetails>(
      {
        guests: { type: Number, required: true, min: 1, max: 100 },
        arrival: String,
        departure: String,
      },
      { _id: false },
    ),
    default: undefined,
  },
  userFrom: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  userTo: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  // One welcome-team correction message per member and set of offer locations.
  locationCorrectionKey: {
    type: String,
  },
  locationCorrectionOffers: [
    {
      offer: { type: Schema.Types.ObjectId, ref: 'Offer' },
      location: [Number],
    },
  ],
  read: {
    type: Boolean,
    default: false,
  },
  spam: {
    type: Boolean,
    // Historical classification only; new messages leave this unset.
  },
  // Hidden delivery path used for shadowbanned/suspended senders:
  // sender can still see own messages, recipients can't.
  shadowHidden: {
    type: Boolean,
    default: false,
    index: true,
  },
  /* Count and the latest date of notifications sent to `userTo`
     about unread messages (`read:false`) */
  notificationCount: {
    type: Number,
    default: 0,
    required: true,
  },
});

MessageSchema.index({ read: 1, created: 1, notificationSent: 1 });
MessageSchema.index({ created: -1, userFrom: 1 });
MessageSchema.index(
  { locationCorrectionKey: 1 },
  { unique: true, sparse: true },
);

MessageSchema.plugin(mongoosePaginate);
mongoose.model<MessageRecord>('Message', MessageSchema);
export default service;
export { service as 'module.exports' };
