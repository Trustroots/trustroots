require('should');
const sinon: typeof import('sinon') = require('sinon');
const mongoose: typeof import('mongoose') = require('mongoose');
const emailService: typeof import('./../../../../core/server/services/email.server.service.mjs') = require('./../../../../core/server/services/email.server.service.mjs');
const unifiedPush: typeof import('./../../../../users/server/services/unified-push.server.service.mjs') = require('./../../../../users/server/services/unified-push.server.service.mjs');
const messageUnreadJobHandler: typeof import('./../../../server/jobs/message-unread.server.job.mjs').run = require('./../../../server/jobs/message-unread.server.job.mjs');

describe('Job: message unread concurrency', function () {
  afterEach(function () {
    sinon.restore();
  });

  it('sends at most 5 notifications at once and marks messages after all sends finish', function (done) {
    const Message = mongoose.model('Message');
    const User = mongoose.model('User');
    const userFromId = new mongoose.Types.ObjectId();
    const userToIds = Array.from(
      { length: 12 },
      () => new mongoose.Types.ObjectId(),
    );
    const messageIds = userToIds.map(() => new mongoose.Types.ObjectId());

    const aggregate = sinon.stub(Message, 'aggregate');
    aggregate.resolves([]);
    aggregate.onFirstCall().resolves(
      userToIds.map((userToId, index) => ({
        _id: { userTo: userToId, userFrom: userFromId },
        messages: [
          { id: messageIds[index], content: 'a message', created: new Date() },
        ],
        notificationCount: 0,
      })),
    );
    sinon.stub(User, 'find').returns({
      exec: () =>
        Promise.resolve(
          [userFromId, ...userToIds].map(_id => ({
            _id,
            email: _id + '@example.test',
            displayName: 'Member',
            roles: ['user'],
          })),
        ),
    } as unknown as ReturnType<typeof User.find>);
    sinon.stub(unifiedPush, 'notifyUnread').resolves();

    let inFlight = 0;
    let maxInFlight = 0;
    const sentTo: string[] = [];
    sinon
      .stub(emailService, 'sendMessagesUnread')
      .callsFake((userFrom, userTo, notification, callback) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        sentTo.push(String(userTo._id));
        setImmediate(() => {
          inFlight--;
          callback();
        });
      });
    const updateMany = sinon.stub(Message, 'updateMany').callsFake(() => {
      inFlight.should.equal(0);
      return Promise.resolve() as unknown as ReturnType<
        typeof Message.updateMany
      >;
    });

    messageUnreadJobHandler({}, function (err?: Error | null) {
      try {
        if (err) throw err;
        maxInFlight.should.equal(5);
        sentTo.should.eql(userToIds.map(String));
        sinon.assert.calledOnce(updateMany);
        (
          updateMany.firstCall.args[0] as { _id: { $in: unknown[] } }
        )._id.$in.should.eql(messageIds);
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});
