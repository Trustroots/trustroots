import mongoose, { type Types } from 'mongoose';
const service = {};

export interface ReferenceThreadRecord {
  _id: Types.ObjectId;
  thread: Types.ObjectId;
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
  reference: 'yes' | 'no';
  created: Date;
}

/**
 * Module dependencies.
 */
const Schema = mongoose.Schema;

/**
 * ReferenceThread Schema
 *
 * This collection is queried mostly with `userFrom` and `userTo` fields
 */
const ReferenceThreadSchema = new Schema<ReferenceThreadRecord>({
  thread: {
    type: Schema.Types.ObjectId,
    ref: 'Thread',
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
  reference: {
    type: String,
    enum: ['yes', 'no'],
    required: true,
  },
  created: {
    type: Date,
    default: Date.now,
  },
});

/**
 * Indexing
 */
ReferenceThreadSchema.index({
  userFrom: 1,
  userTo: 1,
});
ReferenceThreadSchema.index({
  reference: 1,
  created: -1,
});
mongoose.model('ReferenceThread', ReferenceThreadSchema);
export default service;
export { service as 'module.exports' };
