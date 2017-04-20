'use strict';

var path = require('path'),
    config = require(path.resolve('./config/config')),
    url = (config.https ? 'https' : 'http') + '://' + config.domain,
    testutils = require(path.resolve('./testutils'));

describe('Service: push', function() {

  var jobs = testutils.catchJobs();

  var pushService;

  before(function() {
    pushService = require(path.resolve('./modules/core/server/services/push.server.service'));
  });

  it('can send a user notification', function(done) {

    var user = {
      _id: 5,
      pushRegistration: [
        {
          token: '123'
        },
        {
          token: '456'
        }
      ]
    };

    var notification = {
      title: 'a nice title',
      body: 'a nice body',
      click_action: 'http://example.com'
    };

    pushService.sendUserNotification(user, notification, function(err) {

      jobs.length.should.equal(1);
      var job = jobs[0];

      job.type.should.equal('send push message');

      job.data.userId.should.equal(5);
      job.data.tokens.should.deepEqual(['123', '456']);
      job.data.payload.notification.title.should.equal('a nice title');
      job.data.payload.notification.body.should.equal('a nice body');
      job.data.payload.notification.click_action.should.equal('http://example.com');

      done(err);
    });

  });

  it('can send a new push device added notification', function(done) {

    var user = {
      _id: 15,
      pushRegistration: [
        {
          token: 'abc'
        }
      ]
    };

    var platform = 'web';

    pushService.notifyPushDeviceAdded(user, platform, function(err) {
      if (err) return done(err);
      jobs.length.should.equal(1);
      var job = jobs[0];

      job.type.should.equal('send push message');

      job.data.userId.should.equal(15);
      job.data.tokens.should.deepEqual(['abc']);
      job.data.payload.notification.title.should.equal('Trustroots');
      job.data.payload.notification.body.should.equal('You just enabled Trustroots web push notifications. Yay!');
      job.data.payload.notification.click_action.should
        .equal(url + '/profile/edit/account?utm_source=push-notification&utm_medium=fcm&utm_campaign=device-added&utm_content=reply-to');

      done();
    });

  });

  it('can send a messages unread notification', function(done) {

    var userFrom = {
      _id: 1
    };

    var userTo = {
      _id: 5,
      pushRegistration: [
        {
          token: '123'
        }
      ]
    };

    var data = {
      messages: ['foo']
    };

    pushService.notifyMessagesUnread(userFrom, userTo, data, function(err) {
      if (err) return done(err);
      jobs.length.should.equal(1);
      var job = jobs[0];

      job.type.should.equal('send push message');

      job.data.userId.should.equal(5);
      job.data.tokens.should.deepEqual(['123']);
      job.data.payload.notification.title.should.equal('Trustroots');
      job.data.payload.notification.body.should.equal('You have one unread message');
      job.data.payload.notification.click_action.should
        .equal(url + '/messages?utm_source=push-notification&utm_medium=fcm&utm_campaign=messages-unread&utm_content=reply-to');

      done();
    });
  });

});
