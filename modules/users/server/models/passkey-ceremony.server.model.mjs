import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, required: true },
  session: { type: String, required: true },
  authVersion: { type: Number, required: true },
  type: {
    type: String,
    enum: ['registration', 'authentication'],
    required: true,
  },
  challenge: { type: String, required: true },
  userHandle: String,
  label: String,
  expiresAt: { type: Date, required: true },
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
mongoose.model('PasskeyCeremony', schema);
