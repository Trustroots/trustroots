import mongoose, { type Types } from 'mongoose';
export interface SpamCleanupPreview {
  actor: Types.ObjectId;
  expiresAt: Date;
  ids: Types.ObjectId[];
  claimed?: boolean;
  result?: { deleted: number; skipped: number };
}
const schema = new mongoose.Schema<SpamCleanupPreview>({
  actor: { type: mongoose.Schema.Types.ObjectId, required: true },
  expiresAt: { type: Date, required: true },
  ids: [{ type: mongoose.Schema.Types.ObjectId }],
  claimed: Boolean,
  result: mongoose.Schema.Types.Mixed,
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
mongoose.model('SpamCleanupPreview', schema);
