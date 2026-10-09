import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const RequestLimitSchema = new Schema(
  {
    key: { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

RequestLimitSchema.index({ key: 1 }, { unique: true });
RequestLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

mongoose.model('RequestLimit', RequestLimitSchema);

const defaultExport = {};
export default defaultExport;
export { defaultExport as 'module.exports' };
