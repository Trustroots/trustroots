import mongoose, { type PipelineStage, type Types } from 'mongoose';
import errorService from '../../../core/server/services/error.server.service.mjs';
import type { ValidationFailure } from '../../../core/server/services/error.server.service.mts';

interface UsernameChangeHistoryEntry {
  oldUsername: string;
  newUsername: string;
  changedAt: Date;
}

interface UserRecord {
  _id: Types.ObjectId;
  displayName?: string;
  username: string;
  usernameUpdated?: Date;
  usernameHistory?: UsernameChangeHistoryEntry[];
}

interface AdminRequest {
  query?: { page?: unknown; range?: unknown };
}

interface AdminResponse {
  status(code: number): AdminResponse;
  send(body: unknown): unknown;
}

interface UsernameChangeRow {
  _id: Types.ObjectId;
  currentUsername: string;
  displayName?: string;
  oldUsername: string | null;
  newUsername: string;
  changedAt: Date;
  legacy: boolean;
}

const User = mongoose.model<UserRecord>('User');
const PAGE_SIZE = 50;
const WINDOW_DAYS = 90;

function parsePage(value: unknown): number | null {
  if (value === undefined) return 1;
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : null;
}

/** @esmNamed */
export const list = async (
  req: AdminRequest,
  res: AdminResponse,
): Promise<unknown> => {
  const page = parsePage(req.query?.page);
  const range = req.query?.range === undefined ? '90d' : req.query.range;
  if (
    page === null ||
    page > Math.floor(Number.MAX_SAFE_INTEGER / PAGE_SIZE) ||
    (range !== '90d' && range !== 'all')
  ) {
    return res
      .status(400)
      .send({ message: 'Invalid username change filters.' });
  }

  const now = new Date();
  const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const dateCriteria: Record<string, Date> = { $lte: now };
  if (range === '90d') dateCriteria.$gte = since;

  const hasNoHistory = {
    $or: [
      { usernameHistory: { $exists: false } },
      { usernameHistory: { $size: 0 } },
    ],
  };
  const history = { $ifNull: ['$usernameHistory', []] };
  const fallback = {
    $cond: [
      { $ne: [{ $ifNull: ['$usernameUpdated', null] }, null] },
      [
        {
          oldUsername: null,
          newUsername: '$username',
          changedAt: '$usernameUpdated',
          legacy: true,
        },
      ],
      [],
    ],
  };
  const pipeline: PipelineStage[] = [
    {
      $match: {
        $or: [
          { 'usernameHistory.changedAt': dateCriteria },
          {
            $and: [{ usernameUpdated: dateCriteria }, hasNoHistory],
          },
        ],
      },
    },
    {
      $set: {
        usernameChanges: {
          $cond: [{ $gt: [{ $size: history }, 0] }, history, fallback],
        },
      },
    },
    { $unwind: '$usernameChanges' },
    { $match: { 'usernameChanges.changedAt': dateCriteria } },
    {
      $sort: {
        'usernameChanges.changedAt': -1,
        _id: 1,
        'usernameChanges.oldUsername': 1,
        'usernameChanges.newUsername': 1,
      },
    },
    { $skip: (page - 1) * PAGE_SIZE },
    { $limit: PAGE_SIZE + 1 },
    {
      $project: {
        _id: 1,
        currentUsername: '$username',
        displayName: 1,
        oldUsername: '$usernameChanges.oldUsername',
        newUsername: '$usernameChanges.newUsername',
        changedAt: '$usernameChanges.changedAt',
        legacy: { $ifNull: ['$usernameChanges.legacy', false] },
      },
    },
  ];
  try {
    const changes = await User.aggregate<UsernameChangeRow>(pipeline).exec();
    return res.send({
      changes: changes.slice(0, PAGE_SIZE),
      page,
      hasNextPage: changes.length > PAGE_SIZE,
      range,
    });
  } catch (err: unknown) {
    return res.status(400).send({
      message: errorService.getErrorMessage(err as ValidationFailure),
    });
  }
};

const defaultInterop = { list };
export default defaultInterop;
/** @commonjs */
export { defaultInterop as 'module.exports' };
