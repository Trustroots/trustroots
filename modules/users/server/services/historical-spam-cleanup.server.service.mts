import mongoose, { type QueryFilter, type Types } from 'mongoose';
import type { UserServerRecord } from '../models/user.server.types.mts';
interface ActivityRecord {
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
  user: Types.ObjectId;
}

interface BatchResult {
  candidates: number;
  deleted: number;
  eligible: number;
  protected: number;
}

interface RunOptions {
  deleteAccounts?: boolean;
  onBatch?: (batch: BatchResult) => void;
  batchSize?: number;
}

interface CleanupService {
  CAMPAIGN_WINDOWS: Array<{ start: Date; end: Date }>;
  candidateQuery: typeof candidateQuery;
  run: (options?: RunOptions) => Promise<BatchResult>;
}

const service = {} as CleanupService;

/**
 * Identify and remove accounts from the historical automated-signup campaigns
 * of July 2021 and February 2023. The criteria intentionally exclude any
 * account with member, moderation, or uploaded-profile activity.
 */

const BATCH_SIZE = 1000;
const CAMPAIGN_WINDOWS: Array<{ start: Date; end: Date }> = [
  {
    start: new Date('2021-07-04T00:00:00.000Z'),
    end: new Date('2021-07-07T00:00:00.000Z'),
  },
  {
    start: new Date('2023-02-27T00:00:00.000Z'),
    end: new Date('2023-03-01T00:00:00.000Z'),
  },
];
function emptyArrayOrMissing(field: 'member' | 'blocked' | 'pushRegistration') {
  return {
    $or: [
      {
        [field]: {
          $size: 0,
        },
      },
      {
        [field]: {
          $exists: false,
        },
      },
    ],
  };
}
function candidateQuery(): QueryFilter<UserServerRecord> {
  return {
    $and: [
      {
        public: false,
      },
      {
        roles: {
          $all: ['user', 'suspended'],
          $size: 2,
        },
      },
      {
        $or: CAMPAIGN_WINDOWS.map(({ start, end }) => ({
          created: {
            $gte: start,
            $lt: end,
          },
        })),
      },
      emptyArrayOrMissing('member'),
      emptyArrayOrMissing('blocked'),
      emptyArrayOrMissing('pushRegistration'),
      {
        avatarUploaded: {
          $ne: true,
        },
      },
    ],
  };
}
function addIds<Field extends keyof ActivityRecord>(
  ids: Set<string>,
  users: Pick<ActivityRecord, Field>[],
  field: Field,
): void {
  users.forEach(user => {
    ids.add(user[field].toString());
  });
}
async function findUsersWithProtectedActivity(
  userIds: Types.ObjectId[],
): Promise<Set<string>> {
  const Message = mongoose.model<ActivityRecord>('Message');
  const Thread = mongoose.model<ActivityRecord>('Thread');
  const Contact = mongoose.model<ActivityRecord>('Contact');
  const Offer = mongoose.model<ActivityRecord>('Offer');
  const Experience = mongoose.model<ActivityRecord>('Experience');
  const ReferenceThread = mongoose.model<ActivityRecord>('ReferenceThread');
  const AdminNote = mongoose.model<ActivityRecord>('AdminNote');
  const queryByUser = {
    $in: userIds,
  };
  const [
    messagesSent,
    messagesReceived,
    threadsStarted,
    threadsReceived,
    contactsStarted,
    contactsReceived,
    offers,
    experiencesGiven,
    experiencesReceived,
    referencesGiven,
    referencesReceived,
    adminNotes,
  ] = await Promise.all([
    Message.find({
      userFrom: queryByUser,
    })
      .select('userFrom')
      .lean(),
    Message.find({
      userTo: queryByUser,
    })
      .select('userTo')
      .lean(),
    Thread.find({
      userFrom: queryByUser,
    })
      .select('userFrom')
      .lean(),
    Thread.find({
      userTo: queryByUser,
    })
      .select('userTo')
      .lean(),
    Contact.find({
      userFrom: queryByUser,
    })
      .select('userFrom')
      .lean(),
    Contact.find({
      userTo: queryByUser,
    })
      .select('userTo')
      .lean(),
    Offer.find({
      user: queryByUser,
    })
      .select('user')
      .lean(),
    Experience.find({
      userFrom: queryByUser,
    })
      .select('userFrom')
      .lean(),
    Experience.find({
      userTo: queryByUser,
    })
      .select('userTo')
      .lean(),
    ReferenceThread.find({
      userFrom: queryByUser,
    })
      .select('userFrom')
      .lean(),
    ReferenceThread.find({
      userTo: queryByUser,
    })
      .select('userTo')
      .lean(),
    AdminNote.find({
      user: queryByUser,
    })
      .select('user')
      .lean(),
  ]);
  const ids = new Set<string>();
  addIds(ids, messagesSent, 'userFrom');
  addIds(ids, messagesReceived, 'userTo');
  addIds(ids, threadsStarted, 'userFrom');
  addIds(ids, threadsReceived, 'userTo');
  addIds(ids, contactsStarted, 'userFrom');
  addIds(ids, contactsReceived, 'userTo');
  addIds(ids, offers, 'user');
  addIds(ids, experiencesGiven, 'userFrom');
  addIds(ids, experiencesReceived, 'userTo');
  addIds(ids, referencesGiven, 'userFrom');
  addIds(ids, referencesReceived, 'userTo');
  addIds(ids, adminNotes, 'user');
  return ids;
}
async function processBatch(
  userIds: Types.ObjectId[],
  deleteAccounts: boolean,
): Promise<BatchResult> {
  const User = mongoose.model<UserServerRecord>('User');
  const protectedIds = await findUsersWithProtectedActivity(userIds);
  let eligibleIds = userIds.filter(
    userId => !protectedIds.has(userId.toString()),
  );
  let deleted = 0;
  if (deleteAccounts && eligibleIds.length) {
    // Check associated activity once more immediately before deletion. Suspended
    // accounts cannot create member activity, but this protects a concurrent
    // moderation note or account restoration.
    const newlyProtectedIds = await findUsersWithProtectedActivity(eligibleIds);
    eligibleIds = eligibleIds.filter(
      userId => !newlyProtectedIds.has(userId.toString()),
    );
    if (eligibleIds.length) {
      const deletion = await User.deleteMany({
        $and: [
          candidateQuery(),
          {
            _id: {
              $in: eligibleIds,
            },
          },
        ],
      });
      const legacyDeleteResult = deletion as typeof deletion & { n?: number };
      deleted = deletion.deletedCount || legacyDeleteResult.n || 0;
    }
  }
  return {
    candidates: userIds.length,
    deleted,
    eligible: eligibleIds.length,
    protected: userIds.length - eligibleIds.length,
  };
}
service.CAMPAIGN_WINDOWS = CAMPAIGN_WINDOWS;
service.candidateQuery = candidateQuery;
service.run = async function ({
  deleteAccounts = false,
  onBatch,
  batchSize = BATCH_SIZE,
}: RunOptions = {}): Promise<BatchResult> {
  const User = mongoose.model<UserServerRecord>('User');
  const cursor = User.find(candidateQuery())
    .select('_id')
    .sort({
      created: 1,
      _id: 1,
    })
    .lean()
    .cursor();
  const result = {
    candidates: 0,
    eligible: 0,
    protected: 0,
    deleted: 0,
  };
  let userIds: Types.ObjectId[] = [];
  async function flushBatch(): Promise<void> {
    const batchResult = await processBatch(userIds, deleteAccounts);
    result.candidates += batchResult.candidates;
    result.eligible += batchResult.eligible;
    result.protected += batchResult.protected;
    result.deleted += batchResult.deleted;
    userIds = [];
    if (onBatch) {
      onBatch(batchResult);
    }
  }
  for await (const user of cursor) {
    userIds.push(user._id);
    if (userIds.length === batchSize) {
      await flushBatch();
    }
  }
  if (userIds.length) {
    await flushBatch();
  }
  return result;
};
/** Bounded admin review; does not change the CLI campaign criteria. */
export async function previewAdminBatch(after?: Types.ObjectId) {
  const User = mongoose.model<UserServerRecord>('User');
  const query = after
    ? { $and: [candidateQuery(), { _id: { $gt: after } }] }
    : candidateQuery();
  const rows = await User.find(query)
    .select('_id username created')
    .sort({ _id: 1 })
    .limit(101)
    .maxTimeMS(10000)
    .lean();
  const batch = rows.slice(0, 100);
  const protectedIds = await findUsersWithProtectedActivity(
    batch.map(row => row._id),
  );
  return {
    items: batch.map(row => ({
      id: String(row._id),
      username: row.username,
      created: row.created,
      eligible: !protectedIds.has(String(row._id)),
    })),
    hasMore: rows.length > 100,
  };
}

export async function deleteAdminBatch(ids: Types.ObjectId[]) {
  const User = mongoose.model<UserServerRecord>('User');
  const current = await User.find({
    $and: [candidateQuery(), { _id: { $in: ids } }],
  })
    .select('_id')
    .maxTimeMS(10000)
    .lean();
  const result = await processBatch(
    current.map(row => row._id),
    true,
  );
  return { deleted: result.deleted, skipped: ids.length - result.deleted };
}

const defaultExport = service;
export default defaultExport;
export { CAMPAIGN_WINDOWS };
export { candidateQuery };
export const run = defaultExport.run;
export { defaultExport as 'module.exports' };
