import {
  SPAM_CLEANUP_SCAN_SIZE,
  SPAM_CLEANUP_PAGE_SIZE,
  SPAM_INACTIVE_BEFORE,
} from '../../../users/shared/spam-cleanup.ts';
import mongoose, { type Types } from 'mongoose';
import { createHash } from 'node:crypto';
import {
  previewAdminBatch,
  deleteAdminBatch,
} from '../../../users/server/services/historical-spam-cleanup.server.service.mts';
import type {
  SpamCleanupPreview,
  SpamCleanupChunk,
} from '../models/spam-cleanup-preview.server.model.mts';
interface Request {
  body?: unknown;
  user?: { _id: Types.ObjectId; roles: string[] };
}
interface Response {
  status(code: number): Response;
  send(body: unknown): unknown;
}
const Preview = mongoose.model<SpamCleanupPreview>('SpamCleanupPreview');
const Chunk = mongoose.model<SpamCleanupChunk>('SpamCleanupChunk');
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function id(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
}
function expiry() {
  return new Date(Date.now() + 15 * 60_000);
}
async function audit(
  actor: Types.ObjectId,
  route: string,
  previewId: unknown,
  counts: Record<string, number>,
) {
  await new (mongoose.model('AuditLog'))({
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
  const body = req.body;
  if (
    !object(body) ||
    Object.keys(body).some(key => !['previewId', 'page'].includes(key)) ||
    (body.previewId !== undefined && !id(body.previewId)) ||
    (body.page !== undefined &&
      (!Number.isSafeInteger(body.page) ||
        Number(body.page) < 1 ||
        !id(body.previewId)))
  )
    return res.status(400).send({ message: 'Invalid cleanup preview.' });
  try {
    let record;
    if (body.previewId)
      record = await Preview.findOne({
        _id: body.previewId,
        actor: req.user._id,
        expiresAt: { $gt: new Date() },
      });
    else {
      record = new Preview({
        actor: req.user._id,
        expiresAt: expiry(),
        scanSize: SPAM_CLEANUP_SCAN_SIZE,
      });
      await audit(req.user._id, 'spam-cleanup/preview', record._id, {});
      await record.save();
    }
    if (!record)
      return res
        .status(410)
        .send({ message: 'Preview unavailable or expired. Preview again.' });
    if (record.scanSize !== SPAM_CLEANUP_SCAN_SIZE)
      return res
        .status(410)
        .send({ message: 'Preview format changed. Start a fresh preview.' });
    if (record.selectionKey)
      return res.status(409).send({
        message:
          'This preview has started applying. Preview again to review remaining accounts.',
      });
    if (record.building) {
      const claimed = await Preview.findOneAndUpdate(
        {
          _id: record._id,
          chunkCount: record.chunkCount,
          building: true,
          claimed: { $ne: true },
        },
        { $set: { claimed: true } },
        { returnDocument: 'after' },
      );
      if (!claimed)
        return res
          .status(409)
          .send({ message: 'Preview is already being processed.' });
      record = claimed;
      const batch = await previewAdminBatch(record.cursor);
      const ids = batch.items.map(row => new mongoose.Types.ObjectId(row.id));
      const eligibleIds = batch.items
        .filter(row => row.eligible)
        .map(row => new mongoose.Types.ObjectId(row.id));
      if (ids.length) {
        await Chunk.create({
          preview: record._id,
          index: record.chunkCount,
          ids,
          eligibleIds,
          inactiveIds: batch.items
            .filter(row => row.eligible && row.inactive)
            .map(row => new mongoose.Types.ObjectId(row.id)),
          expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
        });
        record.chunkCount++;
        record.cursor = ids[ids.length - 1];
      }
      record.candidates += ids.length;
      record.eligible += eligibleIds.length;
      record.inactive += batch.items.filter(
        row => row.eligible && row.inactive,
      ).length;
      record.unknownLogin += batch.items.filter(
        row => row.eligible && !row.lastSeen,
      ).length;
      record.protected += ids.length - eligibleIds.length;
      record.building = batch.hasMore;
      record.claimed = false;
      record.expiresAt = expiry();
      await record.save();
    }
    record.expiresAt = expiry();
    await record.save();
    const page = Number(body.page ?? 1);
    const pages = Math.ceil(record.candidates / SPAM_CLEANUP_PAGE_SIZE);
    if (page > Math.max(1, pages))
      return res.status(400).send({ message: 'Invalid cleanup page.' });
    // Scanning responses contain counts only, avoiding redundant account reads.
    const offset = (page - 1) * SPAM_CLEANUP_PAGE_SIZE;
    const chunk = record.building
      ? null
      : await Chunk.findOne({
          preview: record._id,
          index: Math.floor(offset / SPAM_CLEANUP_SCAN_SIZE),
        }).lean();
    const pageIds = (chunk?.ids || []).slice(
      offset % SPAM_CLEANUP_SCAN_SIZE,
      (offset % SPAM_CLEANUP_SCAN_SIZE) + SPAM_CLEANUP_PAGE_SIZE,
    );
    const users = pageIds.length
      ? await mongoose
          .model('User')
          .find({ _id: { $in: pageIds } })
          .select('_id username created seen')
          .lean<
            Array<{
              _id: Types.ObjectId;
              username: string;
              created: Date;
              seen?: Date;
            }>
          >()
      : [];
    const byId = new Map(users.map(user => [String(user._id), user]));
    const eligibleIds = new Set(
      (chunk?.eligibleIds || []).map(value => String(value)),
    );
    const inactiveIds = new Set(
      (chunk?.inactiveIds || []).map(value => String(value)),
    );
    const items = pageIds.map(userId => {
      const key = String(userId);
      const user = byId.get(key);
      const eligible = Boolean(user && eligibleIds.has(key));
      return {
        id: key,
        username: user?.username || 'Deleted account',
        created: user?.created?.toISOString() || null,
        lastSeen: user?.seen?.toISOString() || null,
        eligible,
        stage: !eligible
          ? 'protected'
          : inactiveIds.has(key)
            ? 'inactive'
            : 'review',
      };
    });
    return res.send({
      previewId: String(record._id),
      expiresAt: record.expiresAt,
      building: record.building,
      candidates: record.candidates,
      eligible: record.eligible,
      protected: record.protected,
      page,
      pages,
      inactive: record.inactive,
      review: record.eligible - record.inactive,
      unknownLogin: record.unknownLogin,
      inactiveBefore: SPAM_INACTIVE_BEFORE,
      items,
    });
  } catch {
    return res.status(500).send({
      message: 'Unable to preview spam account cleanup. Start a fresh preview.',
    });
  }
}
export async function apply(req: Request, res: Response) {
  if (!req.user?.roles.includes('admin'))
    return res.status(403).send({ message: 'Administrator access required.' });
  const body = req.body;
  if (
    !object(body) ||
    Object.keys(body).some(
      key =>
        !['previewId', 'confirm', 'selection', 'accountIds', 'stage'].includes(
          key,
        ),
    ) ||
    !id(body.previewId) ||
    body.confirm !== true ||
    !['all', 'selected'].includes(String(body.selection)) ||
    !Array.isArray(body.accountIds) ||
    !body.accountIds.every(id) ||
    (body.stage !== undefined &&
      !['inactive', 'review', 'all'].includes(String(body.stage)))
  )
    return res
      .status(400)
      .send({ message: 'Confirm the reviewed selection before deletion.' });
  const stage = body.stage ?? 'all';
  const accountIds = [
    ...new Set(
      (body.accountIds as string[]).map(value =>
        new mongoose.Types.ObjectId(value).toHexString(),
      ),
    ),
  ].sort();
  const selectionKey = createHash('sha256')
    .update(JSON.stringify([body.selection, accountIds, stage]))
    .digest('hex');
  try {
    const filter = {
      _id: body.previewId,
      actor: req.user._id,
      expiresAt: { $gt: new Date() },
    };
    let record = await Preview.findOne(filter);
    if (!record)
      return res
        .status(410)
        .send({ message: 'Preview unavailable or expired. Preview again.' });
    if (record.scanSize !== SPAM_CLEANUP_SCAN_SIZE)
      return res
        .status(410)
        .send({ message: 'Preview format changed. Start a fresh preview.' });
    if (
      record.building ||
      (record.selectionKey && record.selectionKey !== selectionKey)
    )
      return res.status(409).send({
        message:
          'Finish previewing first and keep the reviewed selection unchanged during apply.',
      });
    if (record.result) return res.send(record.result);
    const claimed = await Preview.findOneAndUpdate(
      { ...filter, nextChunk: record.nextChunk, claimed: { $ne: true } },
      { $set: { claimed: true } },
      { returnDocument: 'after' },
    );
    if (!claimed)
      return res.status(409).send({
        message:
          'This preview is already being processed. Preview again if it was interrupted.',
      });
    record = claimed;
    if (!record.selectionKey)
      await audit(req.user._id, 'spam-cleanup/apply', record._id, {
        reviewed: record.eligible,
      });
    const chunk = await Chunk.findOne({
      preview: record._id,
      index: record.nextChunk,
    }).lean();
    if (!chunk && record.nextChunk < record.chunkCount)
      throw new Error('Reviewed chunk unavailable.');
    const exceptions = new Set(accountIds);
    const inactiveIds = new Set(
      (chunk?.inactiveIds || []).map(value => String(value)),
    );
    const stageIds = (chunk?.eligibleIds || []).filter(
      value =>
        stage === 'all' ||
        (stage === 'inactive'
          ? inactiveIds.has(String(value))
          : !inactiveIds.has(String(value))),
    );
    const ids = stageIds.filter(value =>
      body.selection === 'all'
        ? !exceptions.has(String(value))
        : exceptions.has(String(value)),
    );
    const result = await deleteAdminBatch(ids, stage === 'inactive');
    record.selectionKey = selectionKey;
    record.selection = body.selection as 'all' | 'selected';
    record.accountIds = accountIds.map(
      value => new mongoose.Types.ObjectId(value),
    );
    record.deleted += result.deleted;
    record.skipped += result.skipped;
    record.nextChunk++;
    record.claimed = false;
    record.expiresAt = expiry();
    const done = record.nextChunk >= record.chunkCount;
    const progress = { deleted: record.deleted, skipped: record.skipped, done };
    if (done) {
      record.result = progress;
      await audit(req.user._id, 'spam-cleanup/completed', record._id, {
        deleted: record.deleted,
        skipped: record.skipped,
      });
    }
    await record.save();
    return res.send(progress);
  } catch {
    return res.status(500).send({
      message:
        'Cleanup interrupted. Start a fresh preview to check remaining accounts.',
    });
  }
}
