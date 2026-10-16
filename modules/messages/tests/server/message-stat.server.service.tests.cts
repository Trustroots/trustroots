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
let receiverMessage: MessageDocument;

describe('Convert Message Statistics to human readable form', function () {
  it('should convert null values correctly', function () {
    const converted = messageStatService.formatStats({
      replyRate: null,
      replyTime: null,
    });

    converted.should.have.property('replyRate', '');
    converted.should.have.property('replyTime', '');
  });

  it('should convert finite values correctly', function () {
    const converted = messageStatService.formatStats({
      replyRate: 0.37631,
      replyTime: 3600 * 1000 * 3.7,
    });

    converted.should.have.property('replyRate', '38%');
    converted.should.have.property('replyTime', '4 hours');
  });
});

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

    // Two ordinary conversations are below the three-conversation threshold.
    (await readStats()).should.deepEqual({ replyRate: null, replyTime: null });

    // Statistics use current roles: removing the role makes all three eligible.
    await User.updateOne(
      { _id: senders[2]._id },
      { $set: { roles: ['user'] } },
    );
    (await readStats()).should.deepEqual({ replyRate: 0, replyTime: null });
  });

  it('excludes greeters before choosing between the 30-day and 90-day windows', async function () {
    const receiver = users[28];
    const recentGreeters = users.slice(1, 9);
    const olderMembers = users.slice(9, 12);
    await User.updateMany(
      { _id: { $in: recentGreeters.map(user => user._id) } },
      { $set: { roles: ['user', 'welcome-team'] } },
    );

    await MessageStat.insertMany([
      ...recentGreeters.map((sender, index) => ({
        firstMessageUserFrom: sender._id,
        firstMessageUserTo: receiver._id,
        firstMessageCreated: new Date(NOW - (index + 1) * DAY),
        firstMessageLength: 40,
        timeToFirstReply: null,
      })),
      ...olderMembers.map((sender, index) => ({
        firstMessageUserFrom: sender._id,
        firstMessageUserTo: receiver._id,
        firstMessageCreated: new Date(NOW - (32 + index) * DAY),
        firstMessageLength: 40,
        timeToFirstReply: null,
      })),
    ]);

    const stats = await new Promise<{
      replyRate: number | null;
      replyTime: number | null;
    }>((resolve, reject) => {
      messageStatService.readMessageStatsOfUser(
        receiver._id,
        NOW,
        (err, result) => {
          if (err) return reject(err);
          if (!result) return reject(new Error('Expected message statistics'));
          resolve(result);
        },
      );
    });

    // Removing eight recent greeter conversations first leaves three ordinary
    // conversations, so the 90-day sample reaches the display threshold.
    stats.should.deepEqual({ replyRate: 0, replyTime: null });
  });

  it('[< 10 messages in last 90 days] should use 90 days', function (done) {
    messageStatService.readMessageStatsOfUser(
      users[0]._id,
      NOW - 60 * DAY,
      function (err, stats) {
        if (err) return done(err);
        if (!stats) return done(new Error('Expected message statistics'));
        try {
          should(stats).have.property('replyRate', 3 / 8);
          should(stats).have.property('replyTime', 3 * DAY);
          return done();
        } catch (e) {
          return done(e);
        }
      },
    );
  });

  it('[< 10 messages in last 30 days && > 10 in 90 d] should use last 10 messages', function (done) {
    messageStatService.readMessageStatsOfUser(
      users[0]._id,
      NOW - 30 * DAY,
      function (err, stats) {
        // expected statistics values
        // out of last 10 messages, 4 are replied;
        // 2 replied within 3 days and 2 within 1 day
        const expectedReplyRate = 4 / 10;
        const expectedReplyTime = (2 * 3 * DAY + 2 * 1 * DAY) / 4;

        if (err) return done(err);
        try {
          should(stats).have.property('replyRate', expectedReplyRate);
          should(stats).have.property('replyTime', expectedReplyTime);
          return done();
        } catch (e) {
          return done(e);
        }
      },
    );
  });

  it('[> 10 messages in last 30 days] should use last 30 days', function (done) {
    messageStatService.readMessageStatsOfUser(
      users[0]._id,
      NOW,
      function (err, stats) {
        // expected statistics values
        // out of last month 6/12 messages are replied; all within 2 days
        const expectedReplyRate = 6 / 12;
        const expectedReplyTime = 2 * DAY;

        if (err) return done(err);
        try {
          should(stats).have.property('replyRate', expectedReplyRate);
          should(stats).have.property('replyTime', expectedReplyTime);
          return done();
        } catch (e) {
          return done(e);
        }
      },
    );
  });

  it('[no messages] reply rate and time should be null', function (done) {
    messageStatService.readMessageStatsOfUser(
      users[0]._id,
      NOW - 120 * DAY,
      function (err, stats) {
        if (err) return done(err);
        if (!stats) return done(new Error('Expected message statistics'));
        try {
          should(stats).have.property('replyRate', null);
          should(stats).have.property('replyTime', null);
          return done();
        } catch (e) {
          return done(e);
        }
      },
    );
  });

  it('[no replied messages] reply rate should be 0 and reply time null', function (done) {
    messageStatService.readMessageStatsOfUser(
      users[0]._id,
      NOW - 90 * DAY,
      function (err, stats) {
        if (err) return done(err);
        try {
          should(stats).have.property('replyRate', 0);
          should(stats).have.property('replyTime', null);
          return done();
        } catch (e) {
          return done(e);
        }
      },
    );
  });

  it('[some replied messages] reply rate and time should be a number', function (done) {
    messageStatService.readMessageStatsOfUser(
      users[0]._id,
      NOW - 30 * DAY,
      function (err, stats) {
        if (err) return done(err);
        if (!stats) return done(new Error('Expected message statistics'));
        try {
          should(stats).have.property('replyRate');
          should(stats).have.property('replyTime');
          should(stats.replyRate).be.Number();
          should(stats.replyTime).be.Number();
          return done();
        } catch (e) {
          return done(e);
        }
      },
    );
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
    // create a message by receiver
    receiverMessage = new Message({
      content: 'Message content',
      userFrom: receiver._id,
      userTo: initiator._id,
      created: new Date('2016-01-04'),
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
      it('[another message by the initiator before reply] should not change the MessageStat', async function () {
        await saveMessage(firstMessage);
        await updateStats(firstMessage);
        await saveMessage(initiatorMessage);
        (await updateStats(initiatorMessage)).should.equal('other');

        const ts = await findThreadStats();
        should(ts).have.property('firstMessageUserFrom', initiator._id);
        should(ts).have.property('firstMessageUserTo', receiver._id);
        should(ts).have.property('firstMessageCreated', firstMessage.created);
        should(ts).have.property('firstReplyCreated', null);
        should(ts).have.property('firstReplyLength', null);
        should(ts).have.property('timeToFirstReply', null);
      });

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

      it('[later message by the receiver] should not change the MessageStat', async function () {
        await saveMessage(firstMessage);
        await updateStats(firstMessage);
        await saveMessage(firstReply);
        await updateStats(firstReply);
        await saveMessage(receiverMessage);
        (await updateStats(receiverMessage)).should.equal('other');

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
