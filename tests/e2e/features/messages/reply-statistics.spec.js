const { ObjectId } = require('mongodb');
const { annotateFeature, test, expect } = require('../../support/fixtures');
const { updateUserByUsername, withE2eDb } = require('../../support/db');
const {
  SEEDED_ADMIN,
  SEEDED_MEMBERS,
  authenticateViaApi,
} = require('../../support/helpers');

test('reply statistics exclude current greeter conversations before the minimum sample', async ({
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'messages.reply-statistics', [
    'Profile reply statistics exclude current greeters and require three eligible conversations.',
  ]);

  const greeter = SEEDED_MEMBERS[0];
  const ordinarySender = SEEDED_MEMBERS[1];
  const receiver = SEEDED_MEMBERS[2];
  await authenticateViaApi(request, ordinarySender);
  const created = new Date();
  const stats = [greeter.id, ordinarySender.id, SEEDED_ADMIN.id].map(
    (senderId, index) => ({
      _id: new ObjectId(),
      firstMessageUserFrom: new ObjectId(senderId),
      firstMessageUserTo: new ObjectId(receiver.id),
      firstMessageCreated: new Date(created.getTime() - index * 1000),
      firstMessageLength: 30,
      firstReplyCreated: null,
      firstReplyLength: null,
      timeToFirstReply: null,
    }),
  );
  const originalRoles = await withE2eDb(async db => {
    const sender = await db
      .collection('users')
      .findOne({ username: greeter.username }, { projection: { roles: 1 } });
    await db.collection('messagestats').insertMany(stats);
    return sender.roles;
  });

  try {
    await updateUserByUsername(greeter.username, {
      $set: { roles: ['user', 'welcome-team'] },
    });
    const hiddenGreeterStats = await request.get(
      `/api/users/${receiver.username}`,
    );
    expect(hiddenGreeterStats.ok()).toBeTruthy();
    expect(await hiddenGreeterStats.json()).toMatchObject({
      replyRate: '',
      replyTime: '',
    });

    await updateUserByUsername(greeter.username, {
      $set: { roles: originalRoles },
    });
    const eligibleStats = await request.get(`/api/users/${receiver.username}`);
    expect(eligibleStats.ok()).toBeTruthy();
    expect(await eligibleStats.json()).toMatchObject({
      replyRate: '0%',
      replyTime: '',
    });
  } finally {
    await updateUserByUsername(greeter.username, {
      $set: { roles: originalRoles },
    });
    await withE2eDb(db =>
      db.collection('messagestats').deleteMany({
        _id: { $in: stats.map(stat => stat._id) },
      }),
    );
  }
});
