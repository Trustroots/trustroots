'use strict';

var path = require('path'),
    proxyquire = require('proxyquire'),
    mongoose = require('mongoose'),
    User = mongoose.model('User');

describe('job: send push message', function () {

  var sendPushJobHandler,
      messages = []; // collects firebase messages that are sent

  beforeEach(function () {
    sendPushJobHandler = proxyquireFirebaseMessaging(function (token) {
      // decides whether to return error code
      return token === 'toberemoved';
    });
  });

  it('will send a push', function (done) {
    var notification = {
      title: 'a title',
      body: 'a body',
      click_action: 'http://example.com'
    };
    var job = {
      attrs: {
        // eslint-disable-next-line new-cap
        _id: mongoose.Types.ObjectId(),
        data: {
          // eslint-disable-next-line new-cap
          userId: mongoose.Types.ObjectId().toString(),
          pushServices: [
            { platform: 'web', token: '123' },
            { platform: 'web', token: '456' }
          ],
          notification: notification
        }
      }
    };
    sendPushJobHandler(job, function (err) {
      if (err) return done(err);
      messages.length.should.equal(1);
      var message = messages[0];
      message.tokens.should.deepEqual(['123', '456']);
      message.payload.should.deepEqual({ notification: notification });
      done();
    });
  });

  it('will not send a push when notification is missing "click_action"', function (done) {
    var notification = {
      title: 'a title',
      body: 'a body'
    };
    var job = {
      attrs: {
        // eslint-disable-next-line new-cap
        _id: mongoose.Types.ObjectId(),
        data: {
          // eslint-disable-next-line new-cap
          userId: mongoose.Types.ObjectId().toString(),
          pushServices: [
            { platform: 'web', token: '123' }
          ],
          notification: notification
        }
      }
    };
    sendPushJobHandler(job, function (err) {
      if (err) return done(err);
      messages.length.should.equal(0);
      done();
    });
  });

  it('will not send a push when notification is missing "body"', function (done) {
    var notification = {
      title: 'a title',
      click_action: 'http://example.com'
    };
    var job = {
      attrs: {
        // eslint-disable-next-line new-cap
        _id: mongoose.Types.ObjectId(),
        data: {
          // eslint-disable-next-line new-cap
          userId: mongoose.Types.ObjectId().toString(),
          pushServices: [
            { platform: 'web', token: '123' }
          ],
          notification: notification
        }
      }
    };
    sendPushJobHandler(job, function (err) {
      if (err) return done(err);
      messages.length.should.equal(0);
      done();
    });
  });

  it('will not send a push when platform is missing', function (done) {
    var notification = {
      title: 'a title',
      body: 'a body',
      click_action: 'http://example.com'
    };
    var job = {
      attrs: {
        // eslint-disable-next-line new-cap
        _id: mongoose.Types.ObjectId(),
        data: {
          // eslint-disable-next-line new-cap
          userId: mongoose.Types.ObjectId().toString(),
          pushServices: [
            { token: '123' },
            { token: '456' }
          ],
          notification: notification
        }
      }
    };
    sendPushJobHandler(job, function (err) {
      if (err) return done(err);
      messages.length.should.equal(0);
      done();
    });
  });

  it('will not send a push when platform is invalid', function (done) {
    var notification = {
      title: 'a title',
      body: 'a body',
      click_action: 'http://example.com'
    };
    var job = {
      attrs: {
        // eslint-disable-next-line new-cap
        _id: mongoose.Types.ObjectId(),
        data: {
          // eslint-disable-next-line new-cap
          userId: mongoose.Types.ObjectId().toString(),
          pushServices: [
            { platform: 'INVALID', token: '123' },
            { platform: 'INVALID', token: '456' }
          ],
          notification: notification
        }
      }
    };
    sendPushJobHandler(job, function (err) {
      if (err) return done(err);
      messages.length.should.equal(0);
      done();
    });
  });

  context('with user', function () {

    var username = 'username1' + new Date().getTime();
    var userParams = {
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: username + '@test.com',
      username: username,
      password: 'password123!',
      provider: 'local',
      pushRegistration: [
        {
          token: '123',
          platform: 'web'
        },
        {
          token: '456',
          platform: 'web'
        },
        {
          token: 'toberemoved',
          platform: 'web'
        }
      ]
    };

    var user;

    beforeEach(function (done) {
      User.create(userParams, function (err, newUser) {
        if (err) {
          return done(err);
        }
        user = newUser;
        done();
      });
    });

    afterEach(function (done) {
      User.remove().exec(done);
    });

    it('removes user tokens if they are invalid', function (done) {
      var notification = {
        title: 'a title',
        body: 'a body',
        click_action: 'http://example.com'
      };
      var job = {
        attrs: {
          // eslint-disable-next-line new-cap
          _id: mongoose.Types.ObjectId(),
          data: {
            userId: user._id.toString(),
            pushServices: [
              { platform: 'web', token: '123' },
              { platform: 'web', token: '456' },
              { platform: 'web', token: 'toberemoved' }
            ],
            notification: notification
          }
        }
      };
      sendPushJobHandler(job, function (err) {
        if (err) return done(err);
        messages.length.should.equal(1);
        var message = messages[0];
        message.tokens.should.deepEqual(['123', '456', 'toberemoved']);
        message.payload.should.deepEqual({ notification: notification });
        User.findOne(user._id, function (err, updatedUser) {
          if (err) return done(err);
          user.pushRegistration.length.should.equal(3);

          // Invalid token has been removed!
          updatedUser.pushRegistration.length.should.equal(2);
          var tokens = updatedUser.pushRegistration.map(function (reg) {
            return reg.token;
          });
          // we need to convert CoreMongooseArray to Array
          Array.from(tokens).should.deepEqual(['123', '456']);

          done();
        });

      });
    });

  });

  function proxyquireFirebaseMessaging(shouldResponseWithError) {
    messages.length = 0;
    var stubs = {};
    stubs[path.resolve('./config/lib/firebase-messaging')] = createFirebaseMessagingStub(shouldResponseWithError);
    return proxyquire(
      path.resolve('./modules/core/server/jobs/send-push-message.server.job'),
      stubs);
  }

  function createFirebaseMessagingStub(shouldResponseWithError) {
    return {
      sendToDevice: function (tokens, payload) {
        messages.push({ tokens: tokens, payload: payload });
        var results = tokens.map(function (token) {
          if (shouldResponseWithError(token)) {
            return { error: { code: 'messaging/registration-token-not-registered' } };
          } else {
            return {};
          }
        });
        return Promise.resolve({ results: results });
      }
    };
  }

});
