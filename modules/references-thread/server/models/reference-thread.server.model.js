/**
 * Module dependencies.
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * ReferenceThread Schema
 *
 * This collection is queried mostly with `userFrom` and `userTo` fields
 */
const ReferenceThreadSchema = new Schema({
  thread: {
    type: Schema.ObjectId,
    ref: 'Thread',
    required: true,
  },
  userFrom: {
    type: Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  userTo: {
    type: Schema.ObjectId,
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
ReferenceThreadSchema.index({ userFrom: 1, userTo: 1 });

mongoose.model('ReferenceThread', ReferenceThreadSchema);
