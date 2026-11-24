import mongoose from 'mongoose';

const { Schema } = mongoose;

const registration = new Schema({
  _id: { type: String, required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  session: {
    type: Schema.Types.ObjectId,
    ref: 'MobileSession',
    required: true,
  },
  author: { type: String, required: true },
  destination: { type: Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true },
});
registration.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const challenge = new Schema({
  _id: { type: String, required: true },
  user: { type: Schema.Types.ObjectId, required: true },
  session: { type: Schema.Types.ObjectId, required: true },
  transport: { type: String, required: true },
  digest: { type: String, required: true },
  issuedAt: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
});
challenge.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const claim = new Schema({
  _id: { type: String, required: true },
  user: { type: Schema.Types.ObjectId, required: true },
  session: { type: Schema.Types.ObjectId, required: true },
  transport: { type: String, required: true },
  event: { type: Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true },
});
claim.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
claim.index({
  user: 1,
  session: 1,
  transport: 1,
  'event.pubkey': 1,
  expiresAt: -1,
});

mongoose.model('NostranslationAlertRegistration', registration);
mongoose.model('NostranslationAlertChallenge', challenge);
mongoose.model('NostranslationAlertClaim', claim);
