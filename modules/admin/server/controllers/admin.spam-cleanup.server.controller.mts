import mongoose, { type Types } from 'mongoose';
import {
  previewAdminBatch,
  deleteAdminBatch,
} from '../../../users/server/services/historical-spam-cleanup.server.service.mts';
import type { SpamCleanupPreview } from '../models/spam-cleanup-preview.server.model.mts';
interface Request {
  body?: unknown;
  user?: { _id: Types.ObjectId; roles: string[] };
}
interface Response {
  status(code: number): Response;
  send(body: unknown): unknown;
}
const Preview = mongoose.model<SpamCleanupPreview>('SpamCleanupPreview');
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function id(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
}
async function audit(
  actor: Types.ObjectId,
  route: string,
  previewId: unknown,
  counts: Record<string, number>,
) {
  const Audit = mongoose.model('AuditLog');
  await new Audit({
    user: actor,
    route,
    params: { previewId: String(previewId) },
    body: counts,
    query: {},
  }).save();
}
export async function preview(req: Request, res: Response) {
  if (!req.user?.roles.includes('admin'))
    return res.status(403).send({ message: 'Administrator access required.' });
  if (
    !object(req.body) ||
    Object.keys(req.body).some(key => key !== 'after') ||
    (req.body.after !== undefined && !id(req.body.after))
  )
    return res.status(400).send({ message: 'Invalid cleanup cursor.' });
  try {
    const batch = await previewAdminBatch(
      req.body.after
        ? new mongoose.Types.ObjectId(String(req.body.after))
        : undefined,
    );
    const eligible = batch.items.filter(row => row.eligible);
    const record = new Preview({
      actor: req.user._id,
      expiresAt: new Date(Date.now() + 15 * 60_000),
      ids: eligible.map(row => new mongoose.Types.ObjectId(row.id)),
    });
    await audit(req.user._id, 'spam-cleanup/preview', record._id, {
      candidates: batch.items.length,
      eligible: eligible.length,
      protected: batch.items.length - eligible.length,
    });
    await record.save();
    return res.send({
      previewId: String(record._id),
      expiresAt: record.expiresAt,
      ...batch,
      eligible: eligible.length,
      protected: batch.items.length - eligible.length,
    });
  } catch {
    return res
      .status(500)
      .send({ message: 'Unable to preview spam account cleanup.' });
  }
}
export async function apply(req: Request, res: Response) {
  if (!req.user?.roles.includes('admin'))
    return res.status(403).send({ message: 'Administrator access required.' });
  if (
    !object(req.body) ||
    Object.keys(req.body).length !== 2 ||
    !id(req.body.previewId) ||
    req.body.confirm !== true
  )
    return res
      .status(400)
      .send({ message: 'Confirm the reviewed preview before deletion.' });
  try {
    const filter = {
      _id: req.body.previewId,
      actor: req.user._id,
      expiresAt: { $gt: new Date() },
    };
    const record = await Preview.findOne(filter).lean();
    if (!record)
      return res
        .status(410)
        .send({ message: 'Preview unavailable or expired. Preview again.' });
    if (record.result) return res.send(record.result);
    const claimed = await Preview.findOneAndUpdate(
      { ...filter, claimed: { $ne: true } },
      { $set: { claimed: true } },
      { returnDocument: 'after' },
    ).lean();
    if (!claimed)
      return res.status(409).send({
        message:
          'This preview is already being applied. Preview again if it was interrupted.',
      });
    await audit(req.user._id, 'spam-cleanup/apply', record._id, {
      reviewed: claimed.ids.length,
    });
    const result = await deleteAdminBatch(claimed.ids);
    await Preview.updateOne({ _id: claimed._id }, { $set: { result } });
    await audit(req.user._id, 'spam-cleanup/completed', record._id, result);
    return res.send(result);
  } catch {
    return res.status(500).send({
      message:
        'Cleanup interrupted. Preview again to check remaining accounts.',
    });
  }
}
