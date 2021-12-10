/**
 * Module dependencies.
 */
const path = require('path');
const should = require('should');
const mongoose = require('mongoose');
const config = require(path.resolve('./config/config'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

const User = mongoose.model('User');

/**
 * Globals
 */
let user;
let user2;
let user3;

/**
 * Unit tests
 */
describe('User Model Unit Tests:', function () {
  before(function () {
    user = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test@test.com',
      username: 'username123',
      password: 'password123',
      provider: 'local',
    });
    user2 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test@test.com',
      username: 'username123',
      password: 'password123',
      provider: 'local',
    });
    user3 = {
      firstName: 'Different',
      lastName: 'User',
      displayName: 'Full Different Name',
      email: 'test3@test.com',
      username: 'different_username',
      password: 'different_password',
      provider: 'local',
    };
  });

  afterEach(utils.clearDatabase);

  describe('Method Save', function () {
    it('should begin with no users', function (done) {
      User.find({}, function (err, users) {
        users.should.have.length(0);
        done();
      });
    });

    it('should be able to save without problems', function (done) {
      const _user = new User(user);

      _user.save(function (err) {
        should.not.exist(err);
        done();
      });
    });

    it('should fail to save an existing user again', function (done) {
      const _user = new User(user);
      const _user2 = new User(user2);

      _user.save(function () {
        _user2.save(function (err) {
          should.exist(err);
          done();
        });
      });
    });

    it('should be able to generate displayName when saving user', function (done) {
      const _user = new User(user);

      _user.firstName = 'Test';
      _user.save(function (err, savedUser) {
        if (err) return done(err);

        savedUser.firstName.should.equal('Test');
        savedUser.lastName.should.equal('Name');
        savedUser.displayName.should.equal('Test Name');

        done();
      });
    });

    it('should be able to generate displayName when updating user', function (done) {
      const _user = new User(user);

      // Create user
      _user.save(function (err) {
        if (err) return done(err);

        // Re-save the user we just created, but with new first name
        _user.firstName = 'Test';
        _user.save(function (err, savedUser2) {
          if (err) return done(err);

          savedUser2.firstName.should.equal('Test');
          savedUser2.lastName.should.equal('Name');
          savedUser2.displayName.should.equal('Test Name');

          done();
        });
      });
    });

    it('should be able to show an error when try to save without first name', function (done) {
      const _user = new User(user);

      _user.firstName = '';
      _user.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should be able to show an error when try to save with too short password', function (done) {
      const _user = new User(user);

      _user.password = 's1';
      _user.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should confirm that saving user model doesnt change the password', function (done) {
      const _user = new User(user);

      _user.save(function (err) {
        should.not.exist(err);
        const passwordBefore = _user.password;
        _user.firstName = 'test';
        _user.save(function (err) {
          should.not.exist(err);
          const passwordAfter = _user.password;
          passwordBefore.should.equal(passwordAfter);
          done();
        });
      });
    });

    it('should be able to save 2 different users', function (done) {
      const _user = new User(user);
      const _user3 = new User(user3);

      _user.save(function (err) {
        should.not.exist(err);
        _user3.save(function (err) {
          should.not.exist(err);
          done();
        });
      });
    });

    it('should not be able to save different user with the same email address', function (done) {
      const _user = new User(user);
      const _user3 = new User(user3);

      _user.remove(function (err) {
        should.not.exist(err);
        _user.save(function (err) {
          should.not.exist(err);
          const user3_email = _user3.email;
          _user3.email = _user.email;
          _user3.save(function (err) {
            should.exist(err);
            // Restoring the original email for test3 so it can be used in later tests
            _user3.email = user3_email;
            done();
          });
        });
      });
    });

    it('should not be able to save different user with the same username', function (done) {
      const _user = new User(user);
      const _user3 = new User(user3);

      _user.remove(function (err) {
        should.not.exist(err);
        _user.save(function (err) {
          should.not.exist(err);
          const user3_username = _user3.username;
          _user3.username = _user.username;
          _user3.save(function (err) {
            should.exist(err);
            // Restoring the original username for test3 so it can be used in later tests
            _user3.username = user3_username;
            done();
          });
        });
      });
    });
  });

  describe('Username Validation', function () {
    it('should show error to save username beginning with .', function (done) {
      const _user = new User(user);

      _user.username = '.login';
      _user.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should be able to show an error when try to save with not allowed username', function (done) {
      const _user = new User(user);

      _user.username =
        config.illegalStrings[
          Math.floor(Math.random() * config.illegalStrings.length)
        ];
      _user.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should show error to save username end with .', function (done) {
      const _user = new User(user);

      _user.username = 'login.';
      _user.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should show error to save username with ..', function (done) {
      const _user = new User(user);

      _user.username = 'log..in';
      _user.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should show error to save username shorter than 3 character', function (done) {
      const _user = new User(user);

      _user.username = 'lo';
      _user.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should show error saving a username without at least one alphanumeric character', function (done) {
      const _user = new User(user);

      _user.username = '-_-';
      _user.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should show error saving a username longer than 34 characters', function (done) {
      const _user = new User(user);

      _user.username = 'l'.repeat(35);
      _user.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should save username with dot', function (done) {
      const _user = new User(user);

      _user.username = 'log.in';
      _user.save(function (err) {
        should.not.exist(err);
        done();
      });
    });
  });

  describe('Roles Validation', function () {
    it('should show error when trying to save with non-existing role', function (done) {
      const _user = new User(user);

      _user.roles = ['nope'];
      _user.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should save without any roles', function (done) {
      const _user = new User(user);

      _user.roles = [];
      _user.save(function (err) {
        should.not.exist(err);
        done();
      });
    });

    it('should save with "user" role', function (done) {
      const _user = new User(user);

      _user.roles = ['user'];
      _user.save(function (err) {
        should.not.exist(err);
        done();
      });
    });

    it('should save with "admin" role', function (done) {
      const _user = new User(user);

      _user.roles = ['admin'];
      _user.save(function (err) {
        should.not.exist(err);
        done();
      });
    });

    it('should save with "moderator" role', function (done) {
      const _user = new User(user);

      _user.roles = ['moderator'];
      _user.save(function (err) {
        should.not.exist(err);
        done();
      });
    });

    it('should save with "shadowban" role', function (done) {
      const _user = new User(user);

      _user.roles = ['shadowban'];
      _user.save(function (err) {
        should.not.exist(err);
        done();
      });
    });

    it('should save with "suspended" role', function (done) {
      const _user = new User(user);

      _user.roles = ['suspended'];
      _user.save(function (err) {
        should.not.exist(err);
        done();
      });
    });

    it('should save with multiple roles', function (done) {
      const _user = new User(user);

      _user.roles = ['user', 'admin'];
      _user.save(function (err) {
        should.not.exist(err);
        done();
      });
    });
  });

  describe('Language Validation', function () {
    it('should show error when trying to save with non-existing language code', function (done) {
      const _user = new User(user);

      _user.languages = ['nope'];
      _user.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should save without any languages', function (done) {
      const _user = new User(user);

      _user.languages = [];
      _user.save(function (err) {
        should.not.exist(err);
        done();
      });
    });

    it('should save with valid language codes', function (done) {
      const _user = new User(user);

      _user.languages = ['fin', 'iso_639_3-vsi'];
      _user.save(function (err) {
        should.not.exist(err);
        done();
      });
    });
  });
});
