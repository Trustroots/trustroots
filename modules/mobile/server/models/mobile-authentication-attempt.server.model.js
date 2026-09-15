const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const MobileAuthenticationAttemptSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    count: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    // Earlier draft builds stored one document per failure. Keep the atomic
    // counter in a fresh collection so a rolling deployment cannot fail while
    // constructing the new unique key index over those short-lived records.
    collection: 'mobileauthenticationbudgets',
  },
);

MobileAuthenticationAttemptSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 },
);

mongoose.model(
  'MobileAuthenticationAttempt',
  MobileAuthenticationAttemptSchema,
);
