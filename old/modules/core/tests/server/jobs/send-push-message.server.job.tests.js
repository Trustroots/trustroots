// External dependencies
const mongoose = require('mongoose');
const path = require('path');
const proxyquire = require('proxyquire');
const should = require('should');

// Internal dependencies
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

const User = mongoose.model('User');

describe('job: send push message', () => {
  let sendPushJobHandler;
  const messages = []; // Collects firebase messages that are sent

  beforeEach(() => {
    sendPushJobHandler = proxyquireFirebaseMessaging(
      // Decides whether to return error code
      token => token === 'toberemoved',
    );
  });

  it('will send a push', () => {
    const notification = {
      title: 'a title',
      body: 'a body',
      click_action: 'http://example.com',
    };
    const job = {
      attrs: {
        // eslint-disable-next-line new-cap
        _id: mongoose.Types.ObjectId(),
        data: {
          // eslint-disable-next-line new-cap
          userId: mongoose.Types.ObjectId().toString(),
          pushServices: [
            { platform: 'web', token: '123' },
            { platform: 'web', token: '456' },
          ],
          notification,
        },
      },
    };
    sendPushJobHandler(job, err => {
      should.not.exist(err);
      messages.length.should.equal(1);
      const message = messages[0];
      message.tokens.should.deepEqual(['123', '456']);
      message.payload.should.deepEqual({ notification });
    });
  });

  it('will not send a push when notification is missing "click_action"', () => {
    const notification = {
      title: 'a title',
      body: 'a body',
    };
    const job = {
      attrs: {
        // eslint-disable-next-line new-cap
        _id: mongoose.Types.ObjectId(),
        data: {
          // eslint-disable-next-line new-cap
          userId: mongoose.Types.ObjectId().toString(),
          pushServices: [{ platform: 'web', token: '123' }],
          notification,
        },
      },
    };
    sendPushJobHandler(job, err => {
      should.not.exist(err);
      messages.length.should.equal(0);
    });
  });

  it('will not send a push when notification is missing "body"', () => {
    const notification = {
      title: 'a title',
      click_action: 'http://example.com',
    };
    const job = {
      attrs: {
        // eslint-disable-next-line new-cap
        _id: mongoose.Types.ObjectId(),
        data: {
          // eslint-disable-next-line new-cap
          userId: mongoose.Types.ObjectId().toString(),
          pushServices: [{ platform: 'web', token: '123' }],
          notification,
        },
      },
    };
    sendPushJobHandler(job, err => {
      should.not.exist(err);
      messages.length.should.equal(0);
    });
  });

  it('will not send a push when platform is missing', () => {
    const notification = {
      title: 'a title',
      body: 'a body',
      click_action: 'http://example.com',
    };
    const job = {
      attrs: {
        // eslint-disable-next-line new-cap
        _id: mongoose.Types.ObjectId(),
        data: {
          // eslint-disable-next-line new-cap
          userId: mongoose.Types.ObjectId().toString(),
          pushServices: [{ token: '123' }, { token: '456' }],
          notification,
        },
      },
    };
    sendPushJobHandler(job, err => {
      should.not.exist(err);
      messages.length.should.equal(0);
    });
  });

  it('will not send a push when platform is invalid', () => {
    const notification = {
      title: 'a title',
      body: 'a body',
      click_action: 'http://example.com',
    };
    const job = {
      attrs: {
        // eslint-disable-next-line new-cap
        _id: mongoose.Types.ObjectId(),
        data: {
          // eslint-disable-next-line new-cap
          userId: mongoose.Types.ObjectId().toString(),
          pushServices: [
            { platform: 'INVALID', token: '123' },
            { platform: 'INVALID', token: '456' },
          ],
          notification,
        },
      },
    };
    sendPushJobHandler(job, err => {
      should.not.exist(err);
      messages.length.should.equal(0);
    });
  });

  context('with user', () => {
    let user;

    const _user = utils.generateUsers(1, {
      pushRegistration: [
        {
          token: '123',
          platform: 'web',
        },
        {
          token: '456',
          platform: 'web',
        },
        {
          token: 'toberemoved',
          platform: 'web',
        },
      ],
    });

    beforeEach(async () => {
      [user] = await utils.saveUsers(_user);
    });

    afterEach(utils.clearDatabase);

    it('removes user tokens if they are invalid', () => {
      const notification = {
        title: 'a title',
        body: 'a body',
        click_action: 'http://example.com',
      };
      const job = {
        attrs: {
          // eslint-disable-next-line new-cap
          _id: mongoose.Types.ObjectId(),
          data: {
            userId: user._id.toString(),
            pushServices: [
              { platform: 'web', token: '123' },
              { platform: 'web', token: '456' },
              { platform: 'web', token: 'toberemoved' },
            ],
            notification,
          },
        },
      };
      sendPushJobHandler(job, async err => {
        should.not.exist(err);

        messages.length.should.equal(1);
        const message = messages[0];
        message.tokens.should.deepEqual(['123', '456', 'toberemoved']);
        message.payload.should.deepEqual({ notification });
        const updatedUser = await User.findOne(user._id);
        user.pushRegistration.length.should.equal(3);

        // Invalid token has been removed!
        updatedUser.pushRegistration.length.should.equal(2);
        const tokens = updatedUser.pushRegistration.map(reg => reg.token);

        // We need to convert CoreMongooseArray to Array
        Array.from(tokens).should.deepEqual(['123', '456']);
      });
    });
  });

  function proxyquireFirebaseMessaging(shouldResponseWithError) {
    messages.length = 0;
    const stubs = {};
    stubs[path.resolve('./config/lib/firebase-messaging')] =
      createFirebaseMessagingStub(shouldResponseWithError);
    return proxyquire(
      path.resolve('./modules/core/server/jobs/send-push-message.server.job'),
      stubs,
    );
  }

  function createFirebaseMessagingStub(shouldResponseWithError) {
    return {
      sendToDevice(tokens, payload) {
        messages.push({ tokens, payload });
        const results = tokens.map(token => {
          if (shouldResponseWithError(token)) {
            return {
              error: { code: 'messaging/registration-token-not-registered' },
            };
          }

          return {};
        });

        return Promise.resolve({ results });
      },
    };
  }
});
