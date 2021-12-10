const path = require('path');
const config = require(path.resolve('./config/config'));
const url = (config.https ? 'https' : 'http') + '://' + config.domain;
const testutils = require(path.resolve('./testutils/server/server.testutil'));

describe('Service: push', function () {
  const jobs = testutils.catchJobs();

  let pushService;

  before(function () {
    pushService = require(path.resolve(
      './modules/core/server/services/push.server.service',
    ));
  });

  it('can send a user notification', function (done) {
    const user = {
      _id: 5,
      pushRegistration: [
        {
          token: '123',
        },
        {
          token: '456',
        },
      ],
    };

    const notification = {
      title: 'a nice title',
      body: 'a nice body',
      click_action: 'http://example.com',
    };

    pushService.sendUserNotification(user, notification, function (err) {
      jobs.length.should.equal(1);
      const job = jobs[0];

      job.type.should.equal('send push message');

      job.data.userId.should.equal(5);
      job.data.pushServices.should.deepEqual(user.pushRegistration);
      job.data.notification.title.should.equal('a nice title');
      job.data.notification.body.should.equal('a nice body');
      job.data.notification.click_action.should.equal('http://example.com');

      done(err);
    });
  });

  it('can send a new push device added notification', function (done) {
    const user = {
      _id: 15,
      pushRegistration: [
        {
          token: 'abc',
        },
      ],
    };

    const platform = 'web';

    pushService.notifyPushDeviceAdded(user, platform, function (err) {
      if (err) return done(err);
      jobs.length.should.equal(1);
      const job = jobs[0];

      job.type.should.equal('send push message');

      job.data.userId.should.equal(15);
      job.data.pushServices.should.deepEqual(user.pushRegistration);
      job.data.notification.title.should.equal('Trustroots');
      job.data.notification.body.should.equal(
        'You just enabled Trustroots desktop notifications. Yay!',
      );
      job.data.notification.click_action.should.equal(
        url +
          '/profile/edit/account?utm_source=push-notification&utm_medium=fcm&utm_campaign=device-added&utm_content=reply-to',
      );

      done();
    });
  });

  it('can send a messages unread notification', function (done) {
    const userFrom = {
      _id: 1,
    };

    const userTo = {
      _id: 5,
      pushRegistration: [
        {
          token: '123',
        },
      ],
    };

    const data = {
      messages: ['foo'],
    };

    pushService.notifyMessagesUnread(userFrom, userTo, data, function (err) {
      if (err) return done(err);
      jobs.length.should.equal(1);
      const job = jobs[0];

      job.type.should.equal('send push message');

      job.data.userId.should.equal(5);
      job.data.pushServices.should.deepEqual(userTo.pushRegistration);
      job.data.notification.title.should.equal('Trustroots');
      job.data.notification.body.should.equal('You have one unread message');
      job.data.notification.click_action.should.equal(
        url +
          '/messages?utm_source=push-notification&utm_medium=fcm&utm_campaign=messages-unread&utm_content=reply-to',
      );

      done();
    });
  });

  it('can have different text for a second messages unread notification', function (done) {
    const userFrom = {
      _id: 1,
      displayName: 'Albert Einstein',
    };

    const userTo = {
      _id: 5,
      pushRegistration: [
        {
          token: '123',
        },
      ],
    };

    const data = {
      notificationCount: 1,
      messages: ['foo'],
    };

    pushService.notifyMessagesUnread(userFrom, userTo, data, function (err) {
      if (err) return done(err);
      jobs.length.should.equal(1);
      const job = jobs[0];

      job.type.should.equal('send push message');

      job.data.userId.should.equal(5);
      job.data.pushServices.should.deepEqual(userTo.pushRegistration);
      job.data.notification.title.should.equal('Trustroots');
      job.data.notification.body.should.equal(
        userFrom.displayName + ' is still waiting for a reply',
      );
      job.data.notification.click_action.should.equal(
        url +
          '/messages?utm_source=push-notification&utm_medium=fcm&utm_campaign=messages-unread&utm_content=reply-to',
      );

      done();
    });
  });
});
