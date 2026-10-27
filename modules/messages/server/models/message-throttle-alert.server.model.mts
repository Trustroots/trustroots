import mongoose, { type Types } from 'mongoose';

export interface MessageThrottleAlertRecord {
  _id: Types.ObjectId;
  nextAlertAt: Date;
  claim: Types.ObjectId;
}

// One small cooldown record per sender; the built-in _id index serialises claims.
const schema = new mongoose.Schema<MessageThrottleAlertRecord>({
  _id: { type: mongoose.Schema.Types.ObjectId, required: true },
  nextAlertAt: { type: Date, required: true },
  claim: { type: mongoose.Schema.Types.ObjectId, required: true },
});

mongoose.model('MessageThrottleAlert', schema);
