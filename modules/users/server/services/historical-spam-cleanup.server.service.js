/**
 * Identify and remove accounts from the historical automated-signup campaigns
 * of July 2021 and February 2023. The criteria intentionally exclude any
 * account with member, moderation, or uploaded-profile activity.
 */
const mongoose = require('mongoose');

const BATCH_SIZE = 1000;

const CAMPAIGN_WINDOWS = [
  {
    start: new Date('2021-07-04T00:00:00.000Z'),
    end: new Date('2021-07-07T00:00:00.000Z'),
  },
  {
    start: new Date('2023-02-27T00:00:00.000Z'),
    end: new Date('2023-03-01T00:00:00.000Z'),
  },
];

function emptyArrayOrMissing(field) {
  return {
    $or: [{ [field]: { $size: 0 } }, { [field]: { $exists: false } }],
  };
}

function candidateQuery() {
  return {
    $and: [
      { public: false },
      { roles: { $all: ['user', 'suspended'], $size: 2 } },
      {
        $or: CAMPAIGN_WINDOWS.map(({ start, end }) => ({
          created: { $gte: start, $lt: end },
        })),
      },
      emptyArrayOrMissing('member'),
      emptyArrayOrMissing('blocked'),
      emptyArrayOrMissing('pushRegistration'),
      { avatarUploaded: { $ne: true } },
    ],
  };
}

function addIds(ids, users, field) {
  users.forEach(user => {
    ids.add(user[field].toString());
  });
}

async function findUsersWithProtectedActivity(userIds) {
  const Message = mongoose.model('Message');
  const Thread = mongoose.model('Thread');
  const Contact = mongoose.model('Contact');
  const Offer = mongoose.model('Offer');
  const Experience = mongoose.model('Experience');
  const ReferenceThread = mongoose.model('ReferenceThread');
  const AdminNote = mongoose.model('AdminNote');
  const queryByUser = { $in: userIds };

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
    Message.find({ userFrom: queryByUser }).select('userFrom').lean(),
    Message.find({ userTo: queryByUser }).select('userTo').lean(),
    Thread.find({ userFrom: queryByUser }).select('userFrom').lean(),
    Thread.find({ userTo: queryByUser }).select('userTo').lean(),
    Contact.find({ userFrom: queryByUser }).select('userFrom').lean(),
    Contact.find({ userTo: queryByUser }).select('userTo').lean(),
    Offer.find({ user: queryByUser }).select('user').lean(),
    Experience.find({ userFrom: queryByUser }).select('userFrom').lean(),
    Experience.find({ userTo: queryByUser }).select('userTo').lean(),
    ReferenceThread.find({ userFrom: queryByUser }).select('userFrom').lean(),
    ReferenceThread.find({ userTo: queryByUser }).select('userTo').lean(),
    AdminNote.find({ user: queryByUser }).select('user').lean(),
  ]);

  const ids = new Set();
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

async function processBatch(userIds, deleteAccounts) {
  const User = mongoose.model('User');
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
        $and: [candidateQuery(), { _id: { $in: eligibleIds } }],
      });
      deleted = deletion.deletedCount || deletion.n || 0;
    }
  }

  return {
    candidates: userIds.length,
    deleted,
    eligible: eligibleIds.length,
    protected: userIds.length - eligibleIds.length,
  };
}

exports.CAMPAIGN_WINDOWS = CAMPAIGN_WINDOWS;
exports.candidateQuery = candidateQuery;

exports.run = async function ({
  deleteAccounts = false,
  onBatch,
  batchSize = BATCH_SIZE,
} = {}) {
  const User = mongoose.model('User');
  const cursor = User.find(candidateQuery())
    .select('_id')
    .sort({ created: 1, _id: 1 })
    .lean()
    .cursor();
  const result = { candidates: 0, eligible: 0, protected: 0, deleted: 0 };
  let userIds = [];

  async function flushBatch() {
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
