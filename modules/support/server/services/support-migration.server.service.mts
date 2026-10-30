import mongoose from 'mongoose';
import type { SupportRequestRecord } from '../models/support.server.model.mts';

/** Infer historical categories from stored request fields, never current usernames. */
const legacySupportCategoryExpression = {
  $cond: [
    {
      $gt: [
        {
          $strLenCP: {
            $trim: {
              input: {
                $cond: [
                  { $eq: [{ $type: '$reportMember' }, 'string'] },
                  '$reportMember',
                  '',
                ],
              },
            },
          },
        },
        0,
      ],
    },
    'reportMember',
    'other',
  ],
};

export const supportCategoryExpression = {
  $cond: [
    { $in: [{ $ifNull: ['$category', ''] }, ['']] },
    legacySupportCategoryExpression,
    '$category',
  ],
};

/** Explicit, repeatable compatibility migration; never queues correspondence. */
export async function migrateSupportInbox(apply = false) {
  const Request = mongoose.model<SupportRequestRecord>('SupportRequest');
  const [resolved, missing, missingActivity, missingCategory] =
    await Promise.all([
      Request.countDocuments({ status: 'resolved' }),
      Request.countDocuments({ status: { $exists: false } }),
      Request.countDocuments({ lastActivityAt: { $exists: false } }),
      Request.collection.countDocuments({ category: { $in: [null, ''] } }),
    ]);
  if (apply) {
    await Request.updateMany(
      { status: 'resolved' },
      { $set: { status: 'solved' } },
    );
    await Request.updateMany(
      { status: { $exists: false } },
      { $set: { status: 'open' } },
    );
    await Request.updateMany(
      {},
      [
        {
          $set: {
            lastActivityAt: { $ifNull: ['$lastActivityAt', '$sent'] },
            statusRevision: { $ifNull: ['$statusRevision', 0] },
            category: supportCategoryExpression,
          },
        },
      ],
      { updatePipeline: true },
    );
  }
  return {
    resolved,
    missing,
    missingActivity,
    missingCategory,
    applied: apply,
  };
}
