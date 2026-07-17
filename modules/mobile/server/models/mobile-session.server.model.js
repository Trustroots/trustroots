const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const MobileSessionSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  accessTokenHash: {
    type: String,
    required: true,
    unique: true,
  },
  accessExpiresAt: {
    type: Date,
    required: true,
    index: true,
  },
  refreshTokenHash: {
    type: String,
    required: true,
    unique: true,
  },
  refreshExpiresAt: {
    type: Date,
    required: true,
  },
  revokedAt: {
    type: Date,
    default: null,
  },
  created: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

MobileSessionSchema.index({ refreshExpiresAt: 1 }, { expireAfterSeconds: 0 });

mongoose.model('MobileSession', MobileSessionSchema);
