import mongoose, { type Types } from 'mongoose';
import type { SupportStatus } from '../../shared/statuses.ts';
import type {
  SupportStatusImportApplyResponse,
  SupportStatusImportCounts,
} from '../../shared/status-import.ts';

export interface SupportStatusImportPreviewEntry {
  requestId?: Types.ObjectId;
  zendeskTicketId: number;
  status: SupportStatus;
  updatedAt: Date;
  fingerprint: string;
  originalFingerprint?: string;
  state: 'ready' | 'suggested' | 'alreadyApplied' | 'skipped';
  matchKind?: 'exact' | 'suggested';
  senderHash?: string;
  category?: string;
  submittedAt?: Date | null;
  normalisedMessageHash?: string;
  competingCandidateCount?: number;
  reason?:
    | 'invalid'
    | 'duplicate-ticket-id'
    | 'duplicate-fingerprint'
    | 'no-match'
    | 'ambiguous-match'
    | 'ambiguous-source-match'
    | 'newer-local-activity'
    | 'ticket-id-conflict'
    | 'changed-after-preview';
  currentStatus?: string;
  statusRevision?: number;
  statusChangedAt?: Date | null;
  lastActivityAt?: Date | null;
  sent?: Date | null;
  currentTicketId?: number | null;
}

export interface SupportStatusImportPreviewRecord {
  _id: Types.ObjectId;
  actor: Types.ObjectId;
  createdAt: Date;
  expiresAt: Date;
  matchingWindowMinutes?: number;
  appliedAt?: Date;
  applyToken?: string;
  entries: SupportStatusImportPreviewEntry[];
  counts: SupportStatusImportCounts;
  result?: SupportStatusImportApplyResponse;
}

const { Schema } = mongoose;

const SupportStatusImportPreviewSchema =
  new Schema<SupportStatusImportPreviewRecord>(
    {
      actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      createdAt: { type: Date, required: true },
      expiresAt: { type: Date, required: true },
      matchingWindowMinutes: { type: Number, default: 1 },
      appliedAt: { type: Date },
      applyToken: { type: String },
      entries: [
        {
          requestId: { type: Schema.Types.ObjectId },
          zendeskTicketId: { type: Number, required: true },
          status: { type: String, required: true },
          updatedAt: { type: Date, required: true },
          fingerprint: { type: String, required: true },
          originalFingerprint: { type: String },
          matchKind: { type: String },
          senderHash: { type: String },
          category: { type: String },
          submittedAt: { type: Date },
          normalisedMessageHash: { type: String },
          competingCandidateCount: { type: Number },
          state: { type: String, required: true },
          reason: { type: String },
          currentStatus: { type: String },
          statusRevision: { type: Number },
          statusChangedAt: { type: Date },
          lastActivityAt: { type: Date },
          sent: { type: Date },
          currentTicketId: { type: Number },
        },
      ],
      counts: { type: Schema.Types.Mixed, required: true },
      result: { type: Schema.Types.Mixed },
    },
    { versionKey: false },
  );
SupportStatusImportPreviewSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 },
);
mongoose.model('SupportStatusImportPreview', SupportStatusImportPreviewSchema);
const defaultInterop = {};
export default defaultInterop;
export { defaultInterop as 'module.exports' };
