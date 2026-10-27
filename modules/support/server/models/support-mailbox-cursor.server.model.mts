import mongoose from 'mongoose';

interface SupportMailboxCursorRecord {
  _id: string;
  uidValidity: string;
  lastUid: number;
  cutoverAt: Date;
  rescanThroughUid?: number;
  updatedAt: Date;
}

const SupportMailboxCursorSchema =
  new mongoose.Schema<SupportMailboxCursorRecord>(
    {
      _id: { type: String, required: true },
      uidValidity: { type: String, required: true },
      lastUid: { type: Number, required: true },
      cutoverAt: { type: Date, required: true },
      rescanThroughUid: { type: Number },
      updatedAt: { type: Date, default: Date.now },
    },
    { versionKey: false },
  );

mongoose.model('SupportMailboxCursor', SupportMailboxCursorSchema);
const defaultInterop = {};
export default defaultInterop;
export { defaultInterop as 'module.exports' };
