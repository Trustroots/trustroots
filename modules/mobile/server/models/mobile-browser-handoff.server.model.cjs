const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  platform: { type: String, enum: ['ios', 'android'], required: true },
  codeChallenge: { type: String, required: true },
  state: { type: String, required: true },
  createdAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  codeHash: { type: String, unique: true, sparse: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authVersion: Number,
  mfaVerified: Boolean,
});

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

mongoose.model('MobileBrowserHandoff', schema);
