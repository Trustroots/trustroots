import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  userHandle: { type: String, required: true },
  label: { type: String, required: true, maxlength: 64 },
  publicKey: { type: Buffer, required: true, select: false },
  counter: { type: Number, required: true },
  transports: [String],
  deviceType: { type: String, required: true },
  backedUp: { type: Boolean, required: true },
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: Date,
});
mongoose.model('MemberPasskey', schema);

