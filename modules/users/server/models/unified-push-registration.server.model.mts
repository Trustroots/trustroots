import mongoose, { type Types } from 'mongoose';

interface UnifiedPushRegistrationRecord {
  user: Types.ObjectId;
  endpoint: string;
  publicKey: string;
  auth: string;
  updated: Date;
  lastTestRequested?: Date;
}

const schema = new mongoose.Schema<UnifiedPushRegistrationRecord>({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  endpoint: {
    type: String,
    required: true,
    unique: true,
  },
  publicKey: {
    type: String,
    required: true,
  },
  auth: {
    type: String,
    required: true,
  },
  lastTestRequested: Date,
  updated: {
    type: Date,
    default: Date.now,
  },
});
mongoose.model<UnifiedPushRegistrationRecord>(
  'UnifiedPushRegistration',
  schema,
);
