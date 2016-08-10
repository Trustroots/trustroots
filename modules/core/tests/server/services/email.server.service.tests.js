'use strict';

var path = require('path'),
    testutils = require(path.resolve('./testutils'));

var emailService;

describe('service: email', function() {

  var jobs = testutils.catchJobs();

  before(function() {
    emailService = require(path.resolve('./modules/core/server/services/email.server.service'));
  });

  it('can send email confirmation', function(done) {
    var user = {
      displayName: 'test user',
      email: 'test@test.com',
      emailToken: 'emailtoken'
    };
    emailService.sendEmailConfirmation(user, function(err) {
      if (err) return done(err);
      jobs.length.should.equal(1);
      jobs[0].type.should.equal('send email');
      jobs[0].data.subject.should.equal('Confirm Email');
      jobs[0].data.html.should.containEql('You initiated an email change at Trustroots.');
      jobs[0].data.text.should.containEql('You initiated an email change at Trustroots.');
      done();
    });
  });

  it('can send password reset email', function(done) {
    var user = {
      displayName: 'test user',
      email: 'test@test.com',
      resetPasswordToken: 'SOMETOKEN'
    };
    emailService.sendResetPassword(user, function(err) {
      if (err) return done(err);
      jobs.length.should.equal(1);
      jobs[0].type.should.equal('send email');
      jobs[0].data.subject.should.equal('Password Reset');
      jobs[0].data.html.should.containEql(user.resetPasswordToken);
      jobs[0].data.text.should.containEql(user.resetPasswordToken);
      jobs[0].data.text.should.containEql('/api/auth/reset/' + user.resetPasswordToken);
      jobs[0].data.html.should.containEql('/api/auth/reset/' + user.resetPasswordToken);
      jobs[0].data.to.name.should.equal(user.displayName);
      jobs[0].data.to.address.should.equal(user.email);
      done();
    });
  });

  it('can send password reset confirm email', function(done) {
    var user = {
      displayName: 'test user',
      email: 'test@test.com',
      emailToken: 'emailtoken'
    };
    emailService.sendResetPasswordConfirm(user, function(err) {
      if (err) return done(err);
      jobs.length.should.equal(1);
      jobs[0].type.should.equal('send email');
      jobs[0].data.subject.should.equal('Your password has been changed');
      jobs[0].data.to.name.should.equal(user.displayName);
      jobs[0].data.to.address.should.equal(user.email);
      done();
    });
  });

  context('confirm contact', function() {

    var user = {
      displayName: 'test user',
      email: 'test@test.com'
    };
    var friend = {
      displayName: 'friend user',
      email: 'friend@test.com'
    };
    var contact = {
      _id: 'somecontactid'
    };
    var messageHTML = '<span>nice custom message</span>';
    var messageText = 'plain message';

    beforeEach(function(done) {
      emailService.sendConfirmContact(user, friend, contact, messageHTML, messageText, done);
    });

    it('creates a [send email] job', function() {
      jobs.length.should.equal(1);
      jobs[0].type.should.equal('send email');
    });

    it('sends to the correct recipient', function() {
      jobs[0].data.to.name.should.equal(friend.displayName);
      jobs[0].data.to.address.should.equal(friend.email);
    });

    it('sets the subject', function() {
      jobs[0].data.subject.should.equal('Confirm contact');
    });

    it('contains the user and friends name', function() {
      jobs[0].data.html.should.containEql(user.displayName);
      jobs[0].data.html.should.containEql(friend.displayName);
      jobs[0].data.text.should.containEql(user.displayName);
      jobs[0].data.text.should.containEql(friend.displayName);
    });

    it('sets the custom message', function() {
      jobs[0].data.html.should.containEql(messageHTML);
      jobs[0].data.text.should.containEql(messageText);
    });

    it('contains the correct message', function() {
      jobs[0].data.html.should.containEql(user.displayName + '</a> would like to connect with you on Trustroots.');
      jobs[0].data.text.should.containEql(user.displayName + ' would like to connect with you on Trustroots.');
    });

    it('contains the contact confirm url', function() {
      jobs[0].data.html.should.containEql('/contact-confirm/' + contact._id);
      jobs[0].data.text.should.containEql('/contact-confirm/' + contact._id);
    });

  });

  it('can send messages unread email', function(done) {
    var userFrom = {
      _id: 'from-user-id',
      username: 'userfrom',
      displayName: 'from name',
      email: 'from@test.com'
    };
    var userTo = {
      _id: 'to-user-id',
      username: 'userto',
      displayName: 'to name',
      email: 'to@test.com'
    };
    var notification = {
      messages: [
        {
          id: 'message-id-1',
          content: 'message content 1'
        }
      ]
    };
    emailService.sendMessagesUnread(userFrom, userTo, notification, function(err) {
      if (err) return done(err);
      jobs.length.should.equal(1);
      jobs[0].type.should.equal('send email');
      jobs[0].data.subject.should.equal(userFrom.displayName + ' wrote you from Trustroots');
      jobs[0].data.text.should.containEql('You have one unread message from ' + userFrom.displayName + ' at Trustroots.');
      notification.messages.forEach(function(notification) {
        jobs[0].data.text.should.containEql(notification.content);
      });
      jobs[0].data.text.should.containEql('/messages/' + userFrom.username);
      jobs[0].data.text.should.containEql('/profile/' + userFrom.username);
      jobs[0].data.html.should.containEql('/messages/' + userFrom.username);
      jobs[0].data.to.name.should.equal(userTo.displayName);
      jobs[0].data.to.address.should.equal(userTo.email);
      done();
    });
  });

});
