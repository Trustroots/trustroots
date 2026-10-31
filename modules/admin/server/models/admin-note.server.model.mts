import mongoose, { type HydratedDocument, type Types } from 'mongoose';
import textService from './../../../core/server/services/text.server.service.mts';

interface AdminNoteRecord {
  admin?: Types.ObjectId;
  note?: string;
  date?: Date;
  user?: Types.ObjectId;
}

const { Schema } = mongoose;
const AdminNoteSchema = new Schema<AdminNoteRecord>({
  admin: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  note: {
    type: String,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
});

// Sanitize and linkify note before output
AdminNoteSchema.post(/^find$/, (results: unknown) =>
  (results as HydratedDocument<AdminNoteRecord>[]).map(result => {
    result.note = textService.html(result.note!);
    return result;
  }),
);
mongoose.model<AdminNoteRecord>('AdminNote', AdminNoteSchema);
const api = {};
export default api;
export { api as 'module.exports' };
