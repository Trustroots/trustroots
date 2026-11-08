import type {
  MessageDocument,
  MessageModel,
  MessageRecord,
  MessageStatDocument,
  MessageStatModel,
  MessageStatRecord,
  UserDocument,
  UserModel,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';
const should: typeof import('should') = require('should');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const messageStatService: typeof import('./../../server/services/message-stat.server.service.mjs') = require('./../../server/services/message-stat.server.service.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil') = require('../../../../testutils/server/data.server.testutil');

const User = mongoose.model<UserRecord, UserModel>('User');
const Message = mongoose.model<MessageRecord, MessageModel>('Message');
const MessageStat = mongoose.model<MessageStatRecord, MessageStatModel>(
  'MessageStat',
);

let initiator: UserDocument;
let receiver: UserDocument;
let firstMessage: MessageDocument;
let firstReply: MessageDocument;
let initiatorMessage: MessageDocument;

describe('Count Message Statistics of User', function () {
  const NOW = new Date('2002-02-20').getTime(); // an arbitrary date
  const DAY = 24 * 3600 * 1000; // a length of a day in milliseconds
  const users: UserDocument[] = [];

  function seedMessageStats(done: (error?: Error | null) => void) {
    const messageStats: MessageStatDocument[] = [];
    let userno = 1;

    function generateMessageStats(
      count: number,
      repliedCount: number,
      replyTime: number,
      timeNow: number,
    ) {
      for (let i = 0; i < count; ++i) {
        const firstCreated = timeNow - replyTime - (i + 1) * DAY;
        messageStats.push(
          new MessageStat({
            firstMessageUserFrom: users[userno]._id,
            firstMessageUserTo: users[0]._id,
            firstMessageCreated: new Date(firstCreated),
            firstMessageLength: 100,
            firstReplyCreated:
              i < repliedCount ? new Date(firstCreated + replyTime) : null,
            firstReplyLength: i < repliedCount ? 50 : null,
            timeToFirstReply: i < repliedCount ? replyTime : null,
          }),
        );
        ++userno;
      }
    }

    generateMessageStats(12, 6, 2 * DAY, NOW);
    generateMessageStats(8, 2, 1 * DAY, NOW - 30 * DAY);
    generateMessageStats(4, 3, 3 * DAY, NOW - 60 * DAY);
    generateMessageStats(4, 0, 1 * DAY, NOW - 90 * DAY);

    Promise.all(messageStats.map(messageStat => messageStat.save())).then(
      () => done(),
      done,
    );
  }

  beforeEach(async function () {
    users.length = 0;

    await utils.clearDatabase();

    // This statistics test never authenticates its users. Use one valid
    // adaptive hash for all fixtures and insert the schema-shaped documents
    // directly, keeping password-hook/KDF tests in the user model suite.
    const fixturePassword = await User.hashPassword('fixture-password');
    const fixtureUsers = Array.from({ length: 29 }, (_, index) =>
      utils.createTestUser({
        email: `message-stat-member-${index}@example.test`,
        username: `messagestatmember${index}`,
        password: fixturePassword,
      }),
    );
    users.push(...fixtureUsers);
    await User.collection.insertMany(fixtureUsers.map(user => user.toObject()));

    await new Promise<void>((resolve, reject) => {
      seedMessageStats(err => (err ? reject(err) : resolve()));
    });
  });

  afterEach(utils.clearDatabase);

  [
    {
      label: 'unanswered messages from deleted senders',
      deletedUsers: [7],
      expectedRate: 6 / 11,
      expectedTime: 2 * DAY,
    },
    {
      label: 'answered messages from deleted senders',
      deletedUsers: [1],
      expectedRate: 5 / 11,
      expectedTime: 2 * DAY,
    },
    {
      label: 'deleted senders before choosing the last ten messages',
      deletedUsers: [7, 8, 9],
      expectedRate: 7 / 10,
      expectedTime: (6 * 2 * DAY + DAY) / 7,
    },
    {
      label: 'all senders deleted',
      deletedUsers: Array.from({ length: 28 }, (_, i) => i + 1),
      expectedRate: null,
      expectedTime: null,
    },
  ].forEach(({ label, deletedUsers, expectedRate, expectedTime }) => {
    it('should exclude ' + label, async function () {
      await User.deleteMany({
        _id: { $in: deletedUsers.map(index => users[index]._id) },
      });

      const stats = await new Promise<{
        replyRate: number | null;
        replyTime: number | null;
      }>((resolve, reject) => {
        messageStatService.readMessageStatsOfUser(
          users[0]._id,
          NOW,
          (err, result) => {
            if (err) return reject(err);
            if (!result)
              return reject(new Error('Expected message statistics'));
            resolve(result);
          },
        );
      });

      should(stats).have.property('replyRate', expectedRate);
      should(stats).have.property('replyTime', expectedTime);
    });
  });

  it('excludes current greeters before the minimum sample and window selection', async function () {
    const receiver = users[28];
    const senders = [users[1], users[2], users[3]];
    await User.updateOne(
      { _id: senders[2]._id },
      { $set: { roles: ['user', 'welcome-team'] } },
    );
    await MessageStat.insertMany(
      senders.map((sender, index) => ({
        firstMessageUserFrom: sender._id,
        firstMessageUserTo: receiver._id,
        firstMessageCreated: new Date(NOW - (index + 1) * DAY),
        firstMessageLength: 40,
        firstReplyCreated: null,
        firstReplyLength: null,
        timeToFirstReply: null,
      })),
    );

    const readStats = () =>
      new Promise<{ replyRate: number | null; replyTime: number | null }>(
        (resolve, reject) => {
          messageStatService.readMessageStatsOfUser(
            receiver._id,
            NOW,
            (err, stats) => {
              if (err) return reject(err);
              if (!stats)
                return reject(new Error('Expected message statistics'));
              resolve(stats);
            },
          );
        },
      );

    // Two ordinary conversations are below the three-conversation threshold.    (await readStats()).should.deepEqual({ replyRate: null, replyTime: null });

    // Statistics use current roles: removing the role makes all three eligible.
    await User.updateOne(
      { _id: senders[2]._id },
      { $set: { roles: ['user'] } },
    );
    (await readStats()).should.deepEqual({ replyRate: 0, replyTime: null });
  });

  it('leaves out conversations started by members who currently have the welcome-team role', function (done) {
    const sender = (roles: string[]) => ({
      firstMessageUserFrom: { _id: new mongoose.Types.ObjectId(), roles },
      firstMessageCreated: new Date(NOW - DAY),
      timeToFirstReply: null,
    });
    sinon.stub(MessageStat, 'find').returns({
      sort: () => ({
        populate: () => ({
          exec: () =>
            Promise.resolve([
              sender(['user']),
              sender(['user', 'welcome-team']),
              sender(['user']),
            ]),
        }),
      }),
    } as unknown as ReturnType<typeof MessageStat.find>);

    messageStatService.readMessageStatsOfUser(
      users[0]._id,
      NOW,
      (error, stats) => {
        sinon.restore();
        if (error) return done(error);
        try {
          // Two ordinary conversations stay below the three-conversation minimum.
          should(stats).deepEqual({ replyRate: null, replyTime: null });
          done();
        } catch (assertionError) {
          done(assertionError as Error);
        }
      },
    );
  });

  it('keeps conversations started exactly 30 days ago when more than ten are eligible', async function () {
    const receiver = users[28];
    const threshold = NOW - 30 * DAY;
    // Newest first: nine recent replied conversations, two unreplied ones
    // exactly on the cut-off, and an older replied one that is left out.
    const created = [
      ...Array.from({ length: 9 }, (_, i) => NOW - (i + 1) * DAY),
      threshold,
      threshold,
      threshold - DAY,
    ];
    await MessageStat.insertMany(
      created.map((firstMessageCreated, index) => {
        const replied = index < 9 || index === 11;
        return {
          firstMessageUserFrom: users[index + 1]._id,
          firstMessageUserTo: receiver._id,
          firstMessageCreated: new Date(firstMessageCreated),
          firstMessageLength: 40,
          firstReplyCreated: replied
            ? new Date(firstMessageCreated + DAY)
            : null,
          firstReplyLength: replied ? 10 : null,
          timeToFirstReply: replied ? DAY : null,
        };
      }),
    );

    const stats = await new Promise<{
      replyRate: number | null;
      replyTime: number | null;
    }>((resolve, reject) => {
      messageStatService.readMessageStatsOfUser(
        receiver._id,
        NOW,
        (err, result) => (err || !result ? reject(err) : resolve(result)),
      );
    });

    stats.should.deepEqual({ replyRate: 9 / 11, replyTime: DAY });
  });
});

describe('formatStats', function () {
  it('formats a finite reply rate and reply time', function () {
    messageStatService
      .formatStats({ replyRate: 0.5, replyTime: 2 * 3600 * 1000 })
      .should.deepEqual({ replyRate: '50%', replyTime: '2 hours' });
  });

  it('leaves missing and non-finite values empty', function () {
    const empty = { replyRate: '', replyTime: '' };
    messageStatService
      .formatStats({ replyRate: null, replyTime: null })
      .should.deepEqual(empty);
    messageStatService
      .formatStats({ replyRate: NaN, replyTime: NaN })
      .should.deepEqual(empty);
    messageStatService
      .formatStats({ replyRate: Infinity, replyTime: Infinity })
      .should.deepEqual(empty);
  });
});

describe('MessageStat Creation & Updating Test', function () {
  beforeEach(function () {
    // create means create without saving to database, unless explicit
    // create the initiator (User)
    initiator = utils.createTestUser({
      email: 'user1@test.com',
      username: 'username1',
      password: 'password123',
    });

    // create the receiver (User)
    receiver = utils.createTestUser({
      email: 'user2@test.com',
      username: 'username2',
      password: 'password123',
    });

    // create a first message
    firstMessage = new Message({
      content: 'Message content',
      userFrom: initiator._id,
      userTo: receiver._id,
      created: new Date('2016-01-01'),
    });
    // create a first reply
    firstReply = new Message({
      content: 'Message content',
      userFrom: receiver._id,
      userTo: initiator._id,
      created: new Date('2016-01-02'),
    });

    // create a message by initiator
    initiatorMessage = new Message({
      content: 'Message content',
      userFrom: initiator._id,
      userTo: receiver._id,
      created: new Date('2016-01-03'),
    });
  });

  afterEach(utils.clearDatabase);

  describe('updateMessageStat', function () {
    type MessageInput = Required<
      Pick<MessageRecord, 'userFrom' | 'userTo' | 'content' | 'created'>
    >;

    function messageInput(message: MessageDocument): MessageInput {
      if (
        !message.userFrom ||
        !message.userTo ||
        !message.content ||
        !message.created
      ) {
        throw new Error('Expected a complete message fixture');
      }
      return {
        userFrom: message.userFrom,
        userTo: message.userTo,
        content: message.content,
        created: message.created,
      };
    }

    async function saveMessage(message: MessageDocument): Promise<void> {
      await message.save();
    }

    function updateStats(message: MessageDocument): Promise<string> {
      return new Promise((resolve, reject) => {
        messageStatService.updateMessageStat(
          messageInput(message),
          (error, result) => {
            if (error) return reject(error);
            if (!result)
              return reject(new Error('Expected a message-stat result'));
            resolve(result);
          },
        );
      });
    }

    async function findThreadStats(): Promise<MessageStatDocument | null> {
      return MessageStat.findOne({
        $or: [
          {
            firstMessageUserFrom: initiator._id,
            firstMessageUserTo: receiver._id,
          },
          {
            firstMessageUserFrom: receiver._id,
            firstMessageUserTo: initiator._id,
          },
        ],
      }).exec();
    }

    context('First message in Thread', function () {
      it('should create a new MessageStat document and respond `first`', async function () {
        await saveMessage(firstMessage);
        (await updateStats(firstMessage)).should.equal('first');

        const ms = await findThreadStats();
        should(ms).have.property('firstMessageUserFrom', initiator._id);
        should(ms).have.property('firstMessageUserTo', receiver._id);
        should(ms).have.property('firstMessageCreated');
        should(ms).have.property('firstReplyCreated', null);
      });
    });

    context('First reply in Thread', function () {
      it('update the MessageStat with firstReply info & respond firstReply', async function () {
        await saveMessage(firstMessage);
        await updateStats(firstMessage);
        await saveMessage(firstReply);
        (await updateStats(firstReply)).should.equal('firstReply');

        const ms = await findThreadStats();
        should(ms).have.property('firstMessageUserFrom', initiator._id);
        should(ms).have.property('firstMessageUserTo', receiver._id);
        should(ms).have.property('firstMessageCreated');
        should(ms).have.property(
          'firstReplyCreated',
          messageInput(firstReply).created,
        );
        should(ms).have.property(
          'firstReplyLength',
          messageInput(firstReply).content.length,
        );
        should(ms).have.property(
          'timeToFirstReply',
          messageInput(firstReply).created.getTime() -
            messageInput(firstMessage).created.getTime(),
        );
      });
    });

    context('Other messages in Thread', function () {
      it('[another message by the initiator after reply] should not change the MessageStat', async function () {
        await saveMessage(firstMessage);
        await updateStats(firstMessage);
        await saveMessage(firstReply);
        await updateStats(firstReply);
        // Preserve the original fixture sequence: the first reply is saved again.
        await saveMessage(firstReply);
        (await updateStats(initiatorMessage)).should.equal('other');

        const ts = await findThreadStats();
        should(ts).have.property('firstMessageUserFrom', initiator._id);
        should(ts).have.property('firstMessageUserTo', receiver._id);
        should(ts).have.property('firstMessageCreated', firstMessage.created);
        should(ts).have.property(
          'firstReplyCreated',
          messageInput(firstReply).created,
        );
      });
    });

    context('With other threads in the database', function () {
      const otherFrom = new mongoose.Types.ObjectId();
      const otherTo = new mongoose.Types.ObjectId();

      async function seedOtherThread(): Promise<MessageStatDocument> {
        // An unanswered thread whose stat and messages are older than ours.
        await new Message({
          content: 'Other thread',
          userFrom: otherFrom,
          userTo: otherTo,
          created: new Date('2015-01-01'),
        }).save();
        await new Promise<void>((resolve, reject) =>
          messageStatService.updateMessageStat(
            { userFrom: otherFrom, userTo: otherTo },
            error => (error ? reject(error) : resolve()),
          ),
        );
        return (await MessageStat.findOne({
          firstMessageUserFrom: otherFrom,
        }).orFail()) as MessageStatDocument;
      }

      it('creates the stat from the first message of this thread only', async function () {
        await seedOtherThread();
        await saveMessage(firstMessage);
        (await updateStats(firstMessage)).should.equal('first');

        (await MessageStat.countDocuments({})).should.equal(2);
        const ms = await findThreadStats();
        should(ms).have.property('firstMessageUserFrom', initiator._id);
        should(ms).have.property('firstMessageUserTo', receiver._id);
        should(ms!.firstMessageCreated!.getTime()).equal(
          messageInput(firstMessage).created.getTime(),
        );
      });

      it('records the reply on this thread only', async function () {
        const other = await seedOtherThread();
        await saveMessage(firstMessage);
        await updateStats(firstMessage);
        await saveMessage(firstReply);
        (await updateStats(firstReply)).should.equal('firstReply');

        should(await findThreadStats()).have.property('firstReplyLength', 15);
        const untouched = await MessageStat.findById(other._id).orFail();
        should(untouched.firstReplyCreated).equal(null);
        should(untouched.timeToFirstReply).equal(null);
      });

      it('uses the earliest reply and the earliest message of the thread', async function () {
        // Saved latest-first so natural order differs from creation order.
        const laterReply = new Message({
          content: 'Later reply',
          userFrom: receiver._id,
          userTo: initiator._id,
          created: new Date('2016-01-05'),
        });
        await saveMessage(laterReply);
        await saveMessage(firstReply);
        await saveMessage(initiatorMessage);
        await saveMessage(firstMessage);
        (await updateStats(initiatorMessage)).should.equal('firstReply');

        const ms = await findThreadStats();
        should(ms).have.property('firstMessageUserFrom', initiator._id);
        should(ms!.firstReplyCreated!.getTime()).equal(
          messageInput(firstReply).created.getTime(),
        );
        should(ms).have.property('timeToFirstReply', 24 * 3600 * 1000);
      });
    });

    context('Empty thread', function () {
      afterEach(function () {
        sinon.restore();
      });

      it('returns an error when no first message exists in the thread', function (done) {
        sinon.stub(Message, 'findOne').returns({
          sort: () => ({
            exec: () => Promise.resolve(null),
          }),
        } as unknown as ReturnType<MessageModel['findOne']>);

        messageStatService.updateMessageStat(
          messageInput(firstReply),
          function (error: Error | null) {
            should(error).be.an.Error();
            should(error?.message).equal('The Thread is Empty');
            done();
          },
        );
      });
    });

    context("It is the firstReply, but MessageStat doesn't exist", function () {
      it('should respond `firstReply`', async function () {
        await saveMessage(firstMessage);
        await saveMessage(firstReply);
        (await updateStats(firstReply)).should.equal('firstReply');
        const ts = await findThreadStats();
        should(ts).not.equal(null);
      });
    });
  });
});
