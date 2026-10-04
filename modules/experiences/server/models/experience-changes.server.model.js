const mongoose = require('mongoose');

const { Schema } = mongoose;

const ExperienceChangeLinkSchema = new Schema({
  experience: { type: Schema.ObjectId, ref: 'Experience', required: true },
  member: { type: Schema.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  issuedBy: { type: Schema.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

ExperienceChangeLinkSchema.index(
  { experience: 1, member: 1 },
  { unique: true },
);

const ExperienceChangeRequestSchema = new Schema({
  experience: { type: Schema.ObjectId, ref: 'Experience', required: true },
  requester: { type: Schema.ObjectId, ref: 'User', required: true },
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
  reviewedBy: { type: Schema.ObjectId, ref: 'User' },
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
