'use strict';

var path = require('path'),
    should = require('should'),
    testutils = require(path.resolve('./testutils')),
    config = require(path.resolve('./config/config'));

var emailService;

describe('service: email', function() {

  var jobs = testutils.catchJobs();

  before(function() {
    emailService = require(path.resolve('./modules/core/server/services/email.server.service'));
  });

  it('can send signup email confirmation', function(done) {
    var user = {
      displayName: 'test user',
      email: 'test@test.com',
      emailTemporary: 'test@test.com',
      emailToken: 'emailtoken'
    };
    emailService.sendSignupEmailConfirmation(user, function(err) {
      if (err) return done(err);
      jobs.length.should.equal(1);
      jobs[0].type.should.equal('send email');
      jobs[0].data.subject.should.equal('Confirm Email');
      jobs[0].data.to.name.should.equal(user.displayName);
      jobs[0].data.to.address.should.equal(user.emailTemporary);
      ['html', 'text'].forEach(function(format) {
        jobs[0].data[format].should.containEql('Thank you very much for signing up with us.');
        jobs[0].data[format].should.containEql('Confirm your email address (' + user.emailTemporary + ') to complete your Trustroots account.');
        jobs[0].data[format].should.containEql('/confirm-email/' + user.emailToken);
      });
      done();
    });
  });

  it('can send change email confirmation', function(done) {
    var user = {
      displayName: 'test user',
      email: 'test@test.com',
      emailTemporary: 'test-change@test.com',
      emailToken: 'emailtoken'
    };
    emailService.sendChangeEmailConfirmation(user, function(err) {
      if (err) return done(err);
      jobs.length.should.equal(1);
      jobs[0].type.should.equal('send email');
      jobs[0].data.subject.should.equal('Confirm email change');
      jobs[0].data.to.name.should.equal(user.displayName);
      jobs[0].data.to.address.should.equal(user.emailTemporary);
      ['html', 'text'].forEach(function(format) {
        jobs[0].data[format].should.containEql('You initiated an email change at Trustroots.');
        jobs[0].data[format].should.containEql('Please click the confirmation link below to confirm your new email address: ' + user.emailTemporary);
      });
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
      ['html', 'text'].forEach(function(format) {
        jobs[0].data[format].should.containEql(user.resetPasswordToken);
        jobs[0].data[format].should.containEql('/api/auth/reset/' + user.resetPasswordToken);
      });
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

  it('can send support request email', function(done) {
    var supportRequest = {
      message: 'test-support-message',
      username: 'joedoe',
      email: 'test@test.com',
      emailTemp: false,
      displayName: 'Joe Doe',
      userId: '123',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:10.0) Gecko/20100101 Firefox/10.0',
      authenticated: 'yes',
      profilePublic: 'yes',
      signupDate: new Date().toString(),
      reportMember: 'baduser'
    };
    var replyTo = {
      email: 'replyto@test.com'
    };
    emailService.sendSupportRequest(replyTo, supportRequest, function(err) {
      if (err) return done(err);
      jobs.length.should.equal(1);
      jobs[0].type.should.equal('send email');
      jobs[0].data.subject.should.equal('Support request');
      jobs[0].data.replyTo.email.should.equal(replyTo.email);
      should.not.exist(jobs[0].data.replyTo.name);
      jobs[0].data.to.address.should.equal(config.supportEmail);
      jobs[0].data.to.name.should.equal('Trustroots Support');
      jobs[0].data.from.should.equal('Trustroots Support <' + config.supportEmail + '>');
      should.not.exist(jobs[0].data.html);
      should.exist(jobs[0].data.text);
      jobs[0].data.text.should.containEql('test-support-message');
      jobs[0].data.text.should.containEql('Reporting member: ' + supportRequest.reportMember);
      jobs[0].data.text.should.containEql('Username: ' + supportRequest.username);
      jobs[0].data.text.should.containEql('Email: ' + supportRequest.email);
      jobs[0].data.text.should.containEql('Authenticated: ' + supportRequest.authenticated);
      jobs[0].data.text.should.containEql('Browser: ' + supportRequest.userAgent);
      jobs[0].data.text.should.containEql('ID: ' + supportRequest.userId);
      jobs[0].data.text.should.containEql('Signup confirmed: ' + supportRequest.profilePublic);
      jobs[0].data.text.should.containEql('Signup date: ' + supportRequest.signupDate);
      done();
    });
  });

  it('should be able to render text-only emails', function(done) {
    var params = emailService.addEmailBaseTemplateParams({
      subject: 'test',
      name: 'test',
      email: 'test@test.com',
      utmCampaign: 'test',
      urlConfirmPlainText: '#',
      urlConfirm: '#',
      skipHtmlTemplate: true
    });

    emailService.renderEmail('reset-password', params, function(err, email) {
      if (err) return done(err);
      should.exist(email.text);
      should.not.exist(email.html);
      done();
    });
  });

  it('emails should have inline css styles', function(done) {
    var params = emailService.addEmailBaseTemplateParams({
      subject: 'test',
      name: 'test',
      email: 'test@test.com',
      utmCampaign: 'test',
      urlConfirmPlainText: '#',
      urlConfirm: '#'
    });

    emailService.renderEmail('reset-password', params, function(err, email) {
      if (err) return done(err);
      email.html.should.containEql('<body style=');
      done();
    });
  });

});
