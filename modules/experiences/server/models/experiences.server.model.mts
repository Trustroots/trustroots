import mongoose, { type Types } from 'mongoose';
import uniqueValidation from './../../../../config/lib/mongoose-unique-validation.mjs';
const service = {};

/**
 * Module dependencies.
 */
const Schema = mongoose.Schema;

export interface ExperienceRecord {
  _id: Types.ObjectId;
  created: Date;
  public: boolean;
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
  interactions: { met: boolean; guest: boolean; host: boolean };
  recommend: 'yes' | 'no' | 'unknown';
  feedbackPublic?: string;
  removedAt?: Date;
  removedBy?: Types.ObjectId;
  appliedChangeRequests?: Types.ObjectId[];
}

/**
 * Experience Schema
 */
const ExperienceSchema = new Schema<ExperienceRecord>({
  created: {
    type: Date,
    default: () => Date.now(),
    // Date.now is wrapped for sinon.useFakeTimers()
    required: true,
  },
  public: {
    type: Boolean,
    default: false,
    required: true,
  },
  userFrom: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  userTo: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  interactions: {
    met: {
      type: Boolean,
      default: false,
      required: true,
    },
    guest: {
      type: Boolean,
      default: false,
      required: true,
    },
    host: {
      type: Boolean,
      default: false,
      required: true,
    },
  },
  recommend: {
    type: String,
    enum: ['yes', 'no', 'unknown'],
    default: 'unknown',
    required: true,
  },
  feedbackPublic: {
    type: String,
    trim: true,
  },
  removedAt: Date,
  removedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  appliedChangeRequests: {
    type: [Schema.Types.ObjectId],
    default: undefined,
    select: false,
  },
});

/**
 * Indexing
 */
ExperienceSchema.plugin(
  uniqueValidation as Parameters<typeof ExperienceSchema.plugin>[0],
);
ExperienceSchema.index({
  userFrom: 1,
  userTo: 1,
  public: 1,
  created: 1,
});
ExperienceSchema.index(
  {
    userTo: 1,
    public: 1,
    recommend: 1,
    created: -1,
  },
  { name: 'circle_discovery_recommenders' },
);
ExperienceSchema.index(
  {
    userFrom: 1,
    userTo: 1,
  },
  {
    unique: true,
  },
);
mongoose.model('Experience', ExperienceSchema);
export default service;
export { service as 'module.exports' };
