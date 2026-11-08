const mongoose: typeof import('mongoose') = require('mongoose');
require('should');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mjs') = require('../../../../testutils/server/data.server.testutil');
const adminDashboard: typeof import('../../server/controllers/admin.dashboard.server.controller.mts') = require('./../../server/controllers/admin.dashboard.server.controller.mts');

type ObjectId = import('mongoose').Types.ObjectId;
type PublicUser = { _id: string; username: string; displayName: string };
type DashboardItem = {
  _id: string;
  created: string;
  userFrom: PublicUser;
  userTo: PublicUser;
};
type DashboardBody = {
  negativeExperiences: DashboardItem[];
  threadVotes: DashboardItem[];
  topMessengers: { messageCount: number; user: PublicUser }[];
};

const Message = mongoose.model('Message');
const ReferenceThread = mongoose.model('ReferenceThread');
const DAY = 24 * 60 * 60 * 1000;

async function getDashboard(): Promise<DashboardBody> {
  let statusCode = 200;
  let sent: unknown;
  await adminDashboard.getDashboard(
    {},
    {
      status(code: number) {
        statusCode = code;
        return this;
      },
      send(body: unknown) {
        sent = body;
        return this;
      },
    },
  );
  statusCode.should.equal(200);
  // Serialise like Express does, so populated documents become plain JSON.
  return JSON.parse(JSON.stringify(sent));
}

describe('Admin dashboard with stored data', () => {
  let users: Awaited<ReturnType<typeof utils.saveUsersWithCachedPasswords>>;

  function publicUser(index: number): PublicUser {
    const user = users[index];
    return {
      _id: String(user._id),
      username: user.username,
      displayName: String(user.displayName),
    };
  }

  beforeEach(async () => {
    users = await utils.saveUsersWithCachedPasswords(
      utils.generateUsersWithSharedPassword(12),
    );
  });

  afterEach(utils.clearDatabase);

  async function sendMessages(from: number, count: number, ageDays: number) {
    for (let i = 0; i < count; i++) {
      await new Message({
        content: `message ${i}`,
        userFrom: users[from]._id,
        userTo: users[11]._id,
        created: new Date(Date.now() - ageDays * DAY - i * 1000),
      }).save();
    }
  }

  it('ranks the ten most active senders of the last seven days', async () => {
    // Senders 0..10 each send a different number of recent messages, so the
    // ranking is unambiguous and one of them falls outside the top ten.
    for (let sender = 0; sender <= 10; sender++) {
      await sendMessages(sender, sender + 1, 1);
    }
    // Older messages must not count, however many there are.
    await sendMessages(0, 20, 8);

    const body = await getDashboard();

    body.topMessengers.should.deepEqual(
      [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(sender => ({
        messageCount: sender + 1,
        user: publicUser(sender),
      })),
    );
  });

  it('lists the ten newest negative votes and experiences with public user fields', async () => {
    const created = (minutesAgo: number) =>
      new Date(Date.now() - minutesAgo * 60 * 1000);
    // Saved oldest first, so storage order differs from the expected order.
    const voteIds: ObjectId[] = [];
    for (let i = 11; i >= 0; i--) {
      const vote = await new ReferenceThread({
        thread: new mongoose.Types.ObjectId(),
        reference: i === 5 ? 'yes' : 'no',
        userFrom: users[i % 3]._id,
        userTo: users[3 + (i % 3)]._id,
        created: created(i),
      }).save();
      if (i !== 5) voteIds.unshift(vote._id as ObjectId);
    }
    // Also oldest first; minute 2 is a positive experience and minute 4 was
    // removed, so neither is listed.
    const minutes = Array.from({ length: 13 }, (_, i) => 12 - i);
    const experiences = await utils.saveExperiences(
      utils.generateExperiences(
        users,
        minutes.map(minute => [
          // Each pair of members can share only one experience.
          minute % 6,
          6 + Math.floor(minute / 6),
          {
            recommend: minute === 2 ? 'yes' : 'no',
            created: created(minute),
            ...(minute === 4 && { removedAt: created(0) }),
          },
        ]),
      ),
    );
    const listedExperiences = experiences
      .filter((_, i) => minutes[i] !== 2 && minutes[i] !== 4)
      .reverse()
      .slice(0, 10);

    const body = await getDashboard();

    body.threadVotes
      .map(vote => vote._id)
      .should.deepEqual(voteIds.slice(0, 10).map(String));
    body.threadVotes.forEach((vote, position) => {
      const i = [0, 1, 2, 3, 4, 6, 7, 8, 9, 10][position];
      vote.userFrom.should.deepEqual(publicUser(i % 3));
      vote.userTo.should.deepEqual(publicUser(3 + (i % 3)));
    });

    body.negativeExperiences
      .map(experience => experience._id)
      .should.deepEqual(listedExperiences.map(e => String(e._id)));
    body.negativeExperiences.forEach((experience, position) => {
      const stored = listedExperiences[position];
      experience.userFrom.should.deepEqual(
        publicUser(
          users.findIndex(u => u._id.equals(stored.userFrom as ObjectId)),
        ),
      );
      experience.userTo.should.deepEqual(
        publicUser(
          users.findIndex(u => u._id.equals(stored.userTo as ObjectId)),
        ),
      );
    });
  });
});
