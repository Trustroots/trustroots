import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  endpoint: {
    type: String,
    required: true,
    unique: true,
  },
  publicKey: {
    type: String,
    required: true,
  },
  auth: {
    type: String,
    required: true,
  },
  updated: {
    type: Date,
    default: Date.now,
  },
});
mongoose.model('UnifiedPushRegistration', schema);
