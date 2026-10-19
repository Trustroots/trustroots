import mongoose, { type Types } from 'mongoose';

export interface ExperienceChangeLinkRecord {
  experience: Types.ObjectId;
  member: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  issuedBy: Types.ObjectId;
  createdAt: Date;
}

export interface ExperienceChangeRequestRecord {
  experience: Types.ObjectId;
  requester: Types.ObjectId;
  linkIssuedBy?: Types.ObjectId;
  kind: 'edit' | 'remove';
  proposed?: {
    feedbackPublic?: string;
    recommend?: 'yes' | 'no' | 'unknown';
    interactions?: { met?: boolean; guest?: boolean; host?: boolean };
  };
  status: 'pending' | 'processing' | 'approved' | 'rejected';
  active: boolean;
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
}

const { Schema } = mongoose;

const ExperienceChangeLinkSchema = new Schema({
  experience: {
    type: Schema.Types.ObjectId,
    ref: 'Experience',
    required: true,
  },
  member: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  issuedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

ExperienceChangeLinkSchema.index(
  { experience: 1, member: 1 },
  { unique: true },
);

const ExperienceChangeRequestSchema = new Schema({
  experience: {
    type: Schema.Types.ObjectId,
    ref: 'Experience',
    required: true,
  },
  requester: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  linkIssuedBy: { type: Schema.Types.ObjectId, ref: 'User', immutable: true },
  kind: { type: String, enum: ['edit', 'remove'], required: true },
  proposed: {
    feedbackPublic: String,
    recommend: { type: String, enum: ['yes', 'no', 'unknown'] },
    interactions: {
      met: Boolean,
      guest: Boolean,
      host: Boolean,
    },
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'approved', 'rejected'],
    default: 'pending',
    required: true,
  },
  active: { type: Boolean, default: true, required: true },
  createdAt: { type: Date, default: Date.now },
  reviewedAt: Date,
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
});

ExperienceChangeRequestSchema.index(
  { experience: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);
ExperienceChangeRequestSchema.index({
  requester: 1,
  experience: 1,
  createdAt: -1,
});

mongoose.model('ExperienceChangeLink', ExperienceChangeLinkSchema);
mongoose.model('ExperienceChangeRequest', ExperienceChangeRequestSchema);
