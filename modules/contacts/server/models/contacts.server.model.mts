import mongoose, { type Types } from 'mongoose';
const service = {};

export interface ContactRecord {
  created: Date;
  confirmed: boolean;
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
}

/**
 * Module dependencies.
 */
const Schema = mongoose.Schema;

/**
 * Contact Schema
 */
const ContactSchema = new Schema<ContactRecord>({
  created: {
    type: Date,
    default: Date.now,
  },
  confirmed: {
    type: Boolean,
    default: false,
  },
  userFrom: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Missing user!'],
  },
  userTo: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Missing user!'],
  },
});
ContactSchema.index({
  userFrom: 1,
});
ContactSchema.index({
  userTo: 1,
});
ContactSchema.index({
  confirmed: 1,
});
mongoose.model('Contact', ContactSchema);
export default service;
export { service as 'module.exports' };
