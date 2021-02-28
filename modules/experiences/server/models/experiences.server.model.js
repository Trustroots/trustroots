/**
 * Module dependencies.
 */
const mongoose = require('mongoose');
const uniqueValidation = require('mongoose-beautiful-unique-validation');
const Schema = mongoose.Schema;

/**
 * Experience Schema
 */
const ExperienceSchema = new Schema({
  created: {
    type: Date,
    default: () => Date.now(), // Date.now is wrapped for sinon.useFakeTimers()
    required: true,
  },
  public: {
    type: Boolean,
    default: false,
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
});

/**
 * Indexing
 */
ExperienceSchema.plugin(uniqueValidation);
ExperienceSchema.index({ userFrom: 1, userTo: 1, public: 1, created: 1 });
ExperienceSchema.index({ userFrom: 1, userTo: 1 }, { unique: true });

mongoose.model('Experience', ExperienceSchema);
