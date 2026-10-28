import mongoose, { type Types } from 'mongoose';
export interface SpamCleanupPreview {
  actor: Types.ObjectId;
  expiresAt: Date;
  claimed?: boolean;
  building: boolean;
  cursor?: Types.ObjectId;
  chunkCount: number;
  nextChunk: number;
  candidates: number;
  eligible: number;
  protected: number;
  deleted: number;
  skipped: number;
  selectionKey?: string;
  selection?: 'all' | 'selected';
  accountIds: Types.ObjectId[];
  result?: { deleted: number; skipped: number; done: boolean };
}
export interface SpamCleanupChunk {
  preview: Types.ObjectId;
  index: number;
  ids: Types.ObjectId[];
  eligibleIds: Types.ObjectId[];
  expiresAt: Date;
}
const schema = new mongoose.Schema<SpamCleanupPreview>({
  actor: { type: mongoose.Schema.Types.ObjectId, required: true },
  expiresAt: { type: Date, required: true },
  claimed: Boolean,
  building: { type: Boolean, default: true },
  cursor: mongoose.Schema.Types.ObjectId,
  chunkCount: { type: Number, default: 0 },
  nextChunk: { type: Number, default: 0 },
  candidates: { type: Number, default: 0 },
  eligible: { type: Number, default: 0 },
  protected: { type: Number, default: 0 },
  deleted: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },
  selectionKey: String,
  selection: String,
  accountIds: [mongoose.Schema.Types.ObjectId],
  result: mongoose.Schema.Types.Mixed,
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
mongoose.model('SpamCleanupPreview', schema);
const chunkSchema = new mongoose.Schema<SpamCleanupChunk>({
  preview: { type: mongoose.Schema.Types.ObjectId, required: true },
  index: { type: Number, required: true },
  ids: [mongoose.Schema.Types.ObjectId],
  eligibleIds: [mongoose.Schema.Types.ObjectId],
  expiresAt: { type: Date, required: true },
});
chunkSchema.index({ preview: 1, index: 1 }, { unique: true });
chunkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
mongoose.model('SpamCleanupChunk', chunkSchema);
