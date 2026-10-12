import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    _id: String,
    user: { type: mongoose.Schema.Types.ObjectId, required: true },
    eventType: {
      type: String,
      required: true,
      enum: [
        'session_created',
        'session_revoked',
        'sessions_signed_out',
        'password_changed',
        'password_reset',
        'email_changed',
        'mfa_enabled',
        'mfa_disabled',
        'recovery_codes_replaced',
        'recovery_code_used',
      ],
    },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);

schema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
schema.index({ user: 1, createdAt: -1, _id: -1 });

mongoose.model('AccountActivity', schema);
