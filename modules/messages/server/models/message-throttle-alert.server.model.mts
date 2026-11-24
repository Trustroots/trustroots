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

export interface MessageThrottleWindow {
  windowStart: Date;
  windowEnd: Date;
}

export interface MessageThrottleReviewRecord extends MessageThrottleWindow {
  _id: Types.ObjectId;
  sender: Types.ObjectId;
}

const reviewSchema = new mongoose.Schema<MessageThrottleReviewRecord>({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    immutable: true,
  },
  windowStart: { type: Date, required: true, immutable: true },
  windowEnd: { type: Date, required: true, immutable: true },
});

mongoose.model('MessageThrottleReview', reviewSchema);
