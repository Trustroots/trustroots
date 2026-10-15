/**
 * Module dependencies.
 */
import mongoose, { type Types } from 'mongoose';
import errorService from './../../../core/server/services/error.server.service.mjs';
import type { ValidationFailure } from './../../../core/server/services/error.server.service.mts';

interface ReferenceThreadRecord {
  _id: Types.ObjectId;
  thread: Types.ObjectId;
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
  reference: 'yes' | 'no';
  created?: Date;
}

interface UserRecord {
  _id: Types.ObjectId;
  username: string;
  displayName?: string;
}

interface NegativeRecipientCount {
  _id: Types.ObjectId;
  count: number;
}

interface HttpResponse {
  status(code: number): HttpResponse;
  send(body: unknown): unknown;
}

const ReferenceThread =
  mongoose.model<ReferenceThreadRecord>('ReferenceThread');
const User = mongoose.model<UserRecord>('User');
const REFERENCE_THREADS_LIMIT = 500;
const TOP_NEGATIVE_RECIPIENTS_LIMIT = 10;
export const list = async (
  _req: unknown,
  res: HttpResponse,
): Promise<unknown> => {
  try {
    const topScoreCutoff = new Date();
    topScoreCutoff.setUTCFullYear(topScoreCutoff.getUTCFullYear() - 1);
    const [items, topNegativeRecipientCounts] = await Promise.all([
      ReferenceThread.find({
        reference: 'no',
      })
        .sort('-created')
        .limit(REFERENCE_THREADS_LIMIT)
        .populate({
          path: 'userTo',
          select: 'username displayName _id',
          model: 'User',
        })
        .populate({
          path: 'userFrom',
          select: 'username displayName _id',
          model: 'User',
        })
        .exec(),
      ReferenceThread.aggregate<NegativeRecipientCount>([
        {
          $match: {
            created: {
              $gte: topScoreCutoff,
            },
            reference: 'no',
          },
        },
        {
          $group: {
            _id: '$userTo',
            count: {
              $sum: 1,
            },
          },
        },
        {
          $sort: {
            count: -1,
          },
        },
        {
          $limit: TOP_NEGATIVE_RECIPIENTS_LIMIT,
        },
      ]).exec(),
    ]);
    const userIds = (topNegativeRecipientCounts || [])
      .map(({ _id }) => _id)
      .filter(Boolean);
    const users = userIds.length
      ? await User.find({
          _id: {
            $in: userIds,
          },
        })
          .select('username displayName _id')
          .exec()
      : [];
    const usersById = users.reduce<Record<string, UserRecord>>(
      (result, user) => {
        result[user._id.toString()] = user;
        return result;
      },
      {},
    );
    const topNegativeRecipients = (topNegativeRecipientCounts || []).map(
      ({ _id, count }) => ({
        count,
        user: _id ? usersById[_id.toString()] || _id : _id,
      }),
    );
    res.send({
      items: items || [],
      topNegativeRecipients,
    });
  } catch (err: unknown) {
    return res.status(400).send({
      message: errorService.getErrorMessage(err as ValidationFailure),
    });
  }
};
const defaultInterop = {
  list,
};
export default defaultInterop;
export { defaultInterop as 'module.exports' };
