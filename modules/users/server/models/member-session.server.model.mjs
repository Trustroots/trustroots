import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  _id: String,
  user: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  authVersion: Number,
  createdAt: Date,
  lastSeenAt: Date,
  expiresAt: { type: Date, expires: 0 },
  revoked: { type: Boolean, default: false },
});
mongoose.model('MemberSession', schema);
