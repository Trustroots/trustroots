import mongoose, { type Types } from 'mongoose';

interface AuditLogRecord {
  body?: Record<string, unknown>;
  date?: Date;
  ip?: string;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  route?: string;
  user?: Types.ObjectId;
}

const { Schema } = mongoose;

/**
 * Audit log Schema
 *
 * Administrator audit logging collection
 */
const AuditLogSchema = new Schema<AuditLogRecord>({
  body: {
    type: Object,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  ip: {
    type: String,
  },
  params: {
    type: Object,
  },
  query: {
    type: Object,
  },
  route: {
    type: String,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
});
mongoose.model<AuditLogRecord>('AuditLog', AuditLogSchema);
const api = {};
export default api;
export { api as 'module.exports' };
