const should = require('should');
const request = require('supertest');
const mongoose = require('mongoose');
const express = require('../../../../config/lib/express');
const utils = require('../../../../testutils/server/data.server.testutil');

const User = mongoose.model('User');

/**
 * Globals
 */
let app;
let agent;
let user;

function validationFailure(object, error, message, done) {
  agent
    .post('/api/auth/signup/validate')
    .send(object)
    .expect(200)
    .end(function (validateErr, validateRes) {
      // Handle error
      if (validateErr) {
        return done(validateErr);
      }

      validateRes.body.valid.should.be.false();
      validateRes.body.error.should.equal(error);
      validateRes.body.message.should.equal(message);

      done();
    });
}

function validationSuccess(object, done) {
  agent
    .post('/api/auth/signup/validate')
    .send(object)
    .expect(200)
    .end(function (validateErr, validateRes) {
      // Handle error
      if (validateErr) {
        return done(validateErr);
      }

      validateRes.body.valid.should.be.true();
      should.not.exist(validateRes.body.error);
      should.not.exist(validateRes.body.message);

      done();
    });
}

/**
 * User routes tests
 */
describe('User signup validation CRUD tests', function () {
  before(function (done) {
    // Get application
    app = express.init(mongoose.connection);
    agent = request.agent(app);

    done();
  });

  afterEach(utils.clearDatabase);

  describe('Username validation', function () {
    it('should show an error when missing username info', function (done) {
      validationFailure(
        {},
        'username-missing',
        'Please provide required `username` field.',
        done,
      );
    });

    it('should show an error when validating taken username', function (done) {
      // Create an user
      user = new User({
        public: true,
        firstName: 'Full',
        lastName: 'Name',
        displayName: 'Full Name',
        email: 'test@example.org',
        emailToken: 'initial email token',
        username: 'takenusername',
        password: 'TR-I$Aw3$0m4',
        provider: 'local',
      });
      user.save(function () {
        validationFailure(
          { username: 'takenusername' },
          'username-not-available',
          'Username is not available.',
          done,
        );
      });
    });

    it('should reject uppercase username before checking availability', function (done) {
      user = new User({
        public: true,
        firstName: 'Full',
        lastName: 'Name',
        displayName: 'Full Name',
        email: 'case@example.org',
        emailToken: 'initial email token',
        username: 'takencaseusername',
        password: 'TR-I$Aw3$0m4',
        provider: 'local',
      });
      user.save(function () {
        validationFailure(
          { username: 'TAKENCASEUSERNAME' },
          'username-invalid',
          'Username is in invalid format.',
          done,
        );
      });
    });

    it('should show an error when try to validate with not allowed username', function (done) {
      validationFailure(
        { username: 'trustroots' },
        'username-not-available-reserved',
        'Username is not available.',
        done,
      );
    });

    it('should show an error when validating newly reserved usernames', function (done) {
      validationFailure(
        { username: 'nostr' },
        'username-not-available-reserved',
        'Username is not available.',
        function () {
          validationFailure(
            { username: 'messages' },
            'username-not-available-reserved',
            'Username is not available.',
            done,
          );
        },
      );
    });

    describe('Username is in invalid format', function () {
      const invalidMessage = 'Username is in invalid format.';

      it('should show error to validate username beginning with "." (dot)', function (done) {
        validationFailure(
          { username: '.login' },
          'username-invalid',
          invalidMessage,
          done,
        );
      });

      it('should show error to validate username end with "." (dot)', function (done) {
        validationFailure(
          { username: 'login.' },
          'username-invalid',
          invalidMessage,
          done,
        );
      });

      it('should show error to validate username with ..', function (done) {
        validationFailure(
          { username: 'log..in' },
          'username-invalid',
          invalidMessage,
          done,
        );
      });

      it('should show error to validate username shorter than 3 character', function (done) {
        validationFailure(
          { username: 'lo' },
          'username-invalid',
          invalidMessage,
          done,
        );
      });

      it('should show error validating a username without at least one alphanumeric character', function (done) {
        validationFailure(
          { username: '-_-' },
          'username-invalid',
          invalidMessage,
          done,
        );
      });

      it('should show error validating a digits-only username', function (done) {
        validationFailure(
          { username: '123' },
          'username-invalid',
          invalidMessage,
          done,
        );
      });

      it('should show error validating an uppercase username', function (done) {
        validationFailure(
          { username: 'Login' },
          'username-invalid',
          invalidMessage,
          done,
        );
      });

      it('should show error validating a username with a hyphen', function (done) {
        validationFailure(
          { username: 'log-in' },
          'username-invalid',
          invalidMessage,
          done,
        );
      });

      it('should show error validating a username with underscores', function (done) {
        validationFailure(
          { username: 'underscores_score' },
          'username-invalid',
          invalidMessage,
          done,
        );
      });

      it('should show error validating a username longer than 34 characters', function (done) {
        validationFailure(
          { username: 'l'.repeat(35) },
          'username-invalid',
          invalidMessage,
          done,
        );
      });
    });

    describe('Username is valid', function () {
      it('should validate lowercase alphanumeric username with a letter', function (done) {
        validationSuccess({ username: 'login123' }, done);
      });
    });
  });
});
