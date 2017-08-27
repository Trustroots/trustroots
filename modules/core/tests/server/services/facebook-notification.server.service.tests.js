'use strict';

var path = require('path'),
    testutils = require(path.resolve('./testutils/server.testutil')),
    mongoose = require('mongoose'),
    User = mongoose.model('User');

var facebookNotificationService;

describe('Service: facebook notifications', function () {

  var jobs = testutils.catchJobs();

  before(function () {
    facebookNotificationService = require(path.resolve('./modules/core/server/services/facebook-notification.server.service'));
  });

  it('should not send notification to user whos FB id is missing', function (done) {
    // Service expects to receive Mongo objects, thus `new User()` here
    var userFrom = new User({
      username: 'usernameFrom'
    });
    var userTo = new User({
      additionalProvidersData: {
        facebook: {
          accessToken: '1'
        }
      }
    });
    var notification = {
      messages: [
        { message: 1 }
      ]
    };
    facebookNotificationService.notifyMessagesUnread(userFrom, userTo, notification, function (err) {
      if (err) return done(err);

      // Set assertions
      jobs.length.should.equal(0);

      done();
    });
  });

  it('should not send notification to user whos FB access token is missing', function (done) {
    // Service expects to receive Mongo objects, thus `new User()` here
    var userFrom = new User({
      username: 'usernameFrom'
    });
    var userTo = new User({
      additionalProvidersData: {
        facebook: {
          id: 1
        }
      }
    });
    var notification = {
      messages: [
        { message: 1 }
      ]
    };
    facebookNotificationService.notifyMessagesUnread(userFrom, userTo, notification, function (err) {
      if (err) return done(err);

      // Set assertions
      jobs.length.should.equal(0);

      done();
    });
  });

  it('should not allow rendered templates to be longer than 180 characters', function (done) {
    // FB templates are in directory:
    // `./modules/core/server/views/facebook-notifications/`
    facebookNotificationService.renderNotification('test', {}, function (err, res) {
      if (err) return done(err);

      // Set assertions
      res.template.length.should.equal(180);
      res.template.slice(-1).should.equal('…');

      done();
    });
  });

  describe('unread messages notifications', function () {

    it('can send unread messages notification', function (done) {
      // Service expects to receive Mongo objects, thus `new User()` here
      var userFrom = new User({
        username: 'usernameFrom'
      });
      var userTo = new User({
        additionalProvidersData: {
          facebook: {
            id: 1,
            accessToken: '1'
          }
        }
      });
      var notification = {
        messages: [
          { message: 1 }
        ]
      };
      facebookNotificationService.notifyMessagesUnread(userFrom, userTo, notification, function (err) {
        if (err) return done(err);

        // Set assertions
        jobs.length.should.equal(1);
        jobs[0].type.should.equal('send facebook notification');
        jobs[0].data.messageCount.should.equal(1);
        jobs[0].data.toUserFacebookId.should.equal(userTo.additionalProvidersData.facebook.id);
        jobs[0].data.fromUserFacebookId.should.equal(false);
        jobs[0].data.template.should.equal('You have one unread message at Trustroots.');
        jobs[0].data.href.should.containEql('messages/' + userFrom.username + '?iframe_getaway=true');

        // The Graph API accepts a maximum of 180 characters in the message field.
        jobs[0].data.template.length.should.be.belowOrEqual(180);

        done();
      });
    });

    it('can refer to Facebook id of an user who sent the message that initiated the notification', function (done) {
      // Service expects to receive Mongo objects, thus `new User()` here
      var userFrom = new User({
        username: 'usernameFrom',
        additionalProvidersData: {
          facebook: {
            id: 2
          }
        }
      });
      var userTo = new User({
        additionalProvidersData: {
          facebook: {
            id: 1,
            accessToken: '1'
          }
        }
      });
      var notification = {
        messages: [
          { message: 1 }
        ]
      };
      facebookNotificationService.notifyMessagesUnread(userFrom, userTo, notification, function (err) {
        if (err) return done(err);

        // Set assertions
        jobs[0].data.template.should.equal('You have one unread message from @[' + userFrom.additionalProvidersData.facebook.id + '] at Trustroots.');

        // The Graph API accepts a maximum of 180 characters in the message field.
        jobs[0].data.template.length.should.be.belowOrEqual(180);

        done();
      });
    });

    it('can have different template for 2nd notification', function (done) {
      // Service expects to receive Mongo objects, thus `new User()` here
      var userFrom = new User({
        username: 'usernameFrom'
      });
      var userTo = new User({
        additionalProvidersData: {
          facebook: {
            id: 1,
            accessToken: '1'
          }
        }
      });
      var notification = {
        notificationCount: 1,
        messages: [
          { message: 1 }
        ]
      };
      facebookNotificationService.notifyMessagesUnread(userFrom, userTo, notification, function (err) {
        if (err) return done(err);

        // Set assertions
        jobs.length.should.equal(1);
        jobs[0].type.should.equal('send facebook notification');
        jobs[0].data.messageCount.should.equal(1);
        jobs[0].data.toUserFacebookId.should.equal(userTo.additionalProvidersData.facebook.id);
        jobs[0].data.fromUserFacebookId.should.equal(false);
        jobs[0].data.template.should.equal('Someone is still waiting for your reply on Trustroots.');
        jobs[0].data.href.should.containEql('messages/' + userFrom.username + '?iframe_getaway=true');

        // The Graph API accepts a maximum of 180 characters in the message field.
        jobs[0].data.template.length.should.be.belowOrEqual(180);

        done();
      });
    });

    it('should mention how many unread messages user has', function (done) {
      // Service expects to receive Mongo objects, thus `new User()` here
      var userFrom = new User({
        username: 'usernameFrom'
      });
      var userTo = new User({
        additionalProvidersData: {
          facebook: {
            id: 1,
            accessToken: '1'
          }
        }
      });
      var notification = {
        messages: [
          { message: 1 },
          { message: 2 },
          { message: 3 }
        ]
      };
      facebookNotificationService.notifyMessagesUnread(userFrom, userTo, notification, function (err) {
        if (err) return done(err);

        // Set assertions
        jobs[0].data.template.should.equal('You have 3 unread messages at Trustroots.');

        done();
      });
    });

  });

});
