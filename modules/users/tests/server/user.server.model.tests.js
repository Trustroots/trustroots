/**
 * Module dependencies.
 */
const should = require('should');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const sinon = require('sinon');
const config = require('../../../../config/config.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');

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
  before(function (done) {
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

    User.init().then(() => done(), done);
  });

  afterEach(utils.clearDatabase);

  describe('Method Save', function () {
    it('should begin with no users', async function () {
      const users = await User.find({});
      users.should.have.length(0);
    });

    it('should be able to save without problems', async function () {
      const _user = new User(user);

      await _user.save();
    });

    it('should fail to save an existing user again', async function () {
      const _user = new User(user);
      const _user2 = new User(user2);

      await _user.save().catch(() => {});
      await _user2.save().should.be.rejected();
    });

    it('should be able to generate displayName when saving user', async function () {
      const _user = new User(user);

      _user.firstName = 'Test';
      const savedUser = await _user.save();

      savedUser.firstName.should.equal('Test');
      savedUser.lastName.should.equal('Name');
      savedUser.displayName.should.equal('Test Name');
    });

    it('should be able to generate displayName when updating user', async function () {
      const _user = new User(user);

      // Create user
      await _user.save();

      // Re-save the user we just created, but with new first name
      _user.firstName = 'Test';
      const savedUser2 = await _user.save();

      savedUser2.firstName.should.equal('Test');
      savedUser2.lastName.should.equal('Name');
      savedUser2.displayName.should.equal('Test Name');
    });

    it('should be able to show an error when try to save without first name', async function () {
      const _user = new User(user);

      _user.firstName = '';
      await _user.save().should.be.rejected();
    });

    it('should be able to show an error when try to save with too short password', async function () {
      const _user = new User(user);

      _user.password = 's1';
      await _user.save().should.be.rejected();
    });

    it('should confirm that saving user model doesnt change the password', async function () {
      const _user = new User(user);

      await _user.save();
      const passwordBefore = _user.password;
      _user.firstName = 'test';
      await _user.save();
      const passwordAfter = _user.password;
      passwordBefore.should.equal(passwordAfter);
    });

    it('should be able to save 2 different users', async function () {
      const _user = new User(user);
      const _user3 = new User(user3);

      await _user.save();
      await _user3.save();
    });

    it('should not be able to save different user with the same email address', async function () {
      const _user = new User(user);
      const _user3 = new User(user3);

      await _user.deleteOne();
      await _user.save();
      const user3_email = _user3.email;
      _user3.email = _user.email;
      const err = await _user3.save().then(
        () => null,
        e => e,
      );
      should.exist(err);
      err.errors.email.message.should.equal(
        'Account with this email exists already.',
      );
      // Restoring the original email for test3 so it can be used in later tests
      _user3.email = user3_email;
    });

    it('should not be able to save different user with the same username', async function () {
      const _user = new User(user);
      const _user3 = new User(user3);

      await _user.deleteOne();
      await _user.save();
      const user3_username = _user3.username;
      _user3.username = _user.username;
      const err = await _user3.save().then(
        () => null,
        e => e,
      );
      should.exist(err);
      err.errors.username.message.should.equal('Username exists already.');
      // Restoring the original username for test3 so it can be used in later tests
      _user3.username = user3_username;
    });
  });

  describe('Mongoose 6 database compatibility', function () {
    it('reports a duplicate email on updateOne and leaves the stored user unchanged', async function () {
      const first = await new User(user).save();
      const second = await new User(user3).save();

      try {
        await User.updateOne(
          { _id: second._id },
          { $set: { email: first.email } },
        );
        throw new Error('Expected the unique email index to reject the update');
      } catch (err) {
        err.should.be.instanceof(mongoose.Error.ValidationError);
        err.errors.email.message.should.equal(
          'Account with this email exists already.',
        );
      }

      const stored = await User.findById(second._id);
      stored.email.should.equal(user3.email);
    });

    it('reports a duplicate username on findOneAndUpdate without changing the user', async function () {
      const first = await new User(user).save();
      const second = await new User(user3).save();

      try {
        await User.findOneAndUpdate(
          { _id: second._id },
          { $set: { username: first.username } },
          { new: true },
        );
        throw new Error(
          'Expected the unique username index to reject the update',
        );
      } catch (err) {
        err.should.be.instanceof(mongoose.Error.ValidationError);
        err.errors.username.message.should.equal('Username exists already.');
      }

      const stored = await User.findById(second._id);
      stored.username.should.equal(user3.username);
    });

    it('keeps unknown query fields in the MongoDB filter', async function () {
      await new User(user).save();

      const match = await User.findOne({
        username: user.username,
        fieldNotInSchema: 'anonymous-value',
      });

      should.not.exist(match);
    });
  });

  describe('Username Validation', function () {
    it('should show error to save username beginning with .', async function () {
      const _user = new User(user);

      _user.username = '.login';
      await _user.save().should.be.rejected();
    });

    it('should be able to show an error when try to save with not allowed username', async function () {
      const _user = new User(user);

      _user.username =
        config.illegalStrings[
          Math.floor(Math.random() * config.illegalStrings.length)
        ];
      await _user.save().should.be.rejected();
    });

    it('should show error to save username end with .', async function () {
      const _user = new User(user);

      _user.username = 'login.';
      await _user.save().should.be.rejected();
    });

    it('should show error to save username with ..', async function () {
      const _user = new User(user);

      _user.username = 'log..in';
      await _user.save().should.be.rejected();
    });

    it('should show error to save username shorter than 3 character', async function () {
      const _user = new User(user);

      _user.username = 'lo';
      await _user.save().should.be.rejected();
    });

    it('should show error saving a username without at least one alphanumeric character', async function () {
      const _user = new User(user);

      _user.username = '-_-';
      await _user.save().should.be.rejected();
    });

    it('should show error saving a username longer than 34 characters', async function () {
      const _user = new User(user);

      _user.username = 'l'.repeat(35);
      await _user.save().should.be.rejected();
    });

    it('should save username with dot', async function () {
      const _user = new User(user);

      _user.username = 'log.in';
      await _user.save();
    });
  });

  describe('Roles Validation', function () {
    it('should show error when trying to save with non-existing role', async function () {
      const _user = new User(user);

      _user.roles = ['nope'];
      await _user.save().should.be.rejected();
    });

    it('should save without any roles', async function () {
      const _user = new User(user);

      _user.roles = [];
      await _user.save();
    });

    it('should save with "user" role', async function () {
      const _user = new User(user);

      _user.roles = ['user'];
      await _user.save();
    });

    it('should save with "admin" role', async function () {
      const _user = new User(user);

      _user.roles = ['admin'];
      await _user.save();
    });

    it('should tolerate legacy "moderator" role', async function () {
      const _user = new User(user);

      _user.roles = ['moderator'];
      await _user.save();
    });

    it('should save with "shadowban" role', async function () {
      const _user = new User(user);

      _user.roles = ['shadowban'];
      await _user.save();
    });

    it('should save with "suspended" role', async function () {
      const _user = new User(user);

      _user.roles = ['suspended'];
      await _user.save();
    });

    it('should save with multiple roles', async function () {
      const _user = new User(user);

      _user.roles = ['user', 'admin'];
      await _user.save();
    });
  });

  describe('Language Validation', function () {
    it('should show error when trying to save with non-existing language code', async function () {
      const _user = new User(user);

      _user.languages = ['nope'];
      await _user.save().should.be.rejected();
    });

    it('should save without any languages', async function () {
      const _user = new User(user);

      _user.languages = [];
      await _user.save();
    });

    it('should save with valid language codes', async function () {
      const _user = new User(user);

      _user.languages = ['fin', 'iso_639_3-vsi'];
      await _user.save();
    });
  });

  describe('Password hash migration', function () {
    const baseUser = {
      firstName: 'Anonymous',
      lastName: 'Traveller',
      email: 'hash-migration@example.org',
      username: 'hash_migration_user',
      provider: 'local',
    };

    it('hashes modified plaintext with scrypt and clears the separate salt', async function () {
      const candidate = new User({ ...baseUser, password: 'new-password-123' });
      await candidate.save();

      candidate.password.should.match(/^\$scrypt\$v=1\$/);
      should(candidate.salt).be.undefined();
      (await candidate.authenticate('new-password-123')).should.be.true();
      (await candidate.authenticate('wrong-password')).should.be.false();
    });

    it('hashes a password that resembles a tagged hash as plaintext on save', async function () {
      const supplied = '$scrypt$v=1$ln=17,r=8,p=1$not-a-salt$not-a-key';
      const candidate = new User({ ...baseUser, password: supplied });
      await candidate.save();

      candidate.password.should.not.equal(supplied);
      (await candidate.authenticate(supplied)).should.be.true();
    });

    it('upgrades a verified legacy hash with a compare-and-set without changing authVersion', async function () {
      const legacySalt = crypto.randomBytes(16);
      const legacyPassword = crypto
        .pbkdf2Sync('legacy-password', legacySalt, 10000, 64, 'sha1')
        .toString('base64');
      const candidate = new User({
        ...baseUser,
        password: legacyPassword,
        salt: legacySalt.toString('base64'),
      });
      const update = sinon
        .stub(User, 'updateOne')
        .callsFake((filter, changes) => {
          filter.password.should.equal(legacyPassword);
          filter.salt.should.equal(legacySalt.toString('base64'));
          filter.$or.should.deepEqual([
            { authVersion: { $exists: false } },
            { authVersion: 0 },
          ]);
          changes.$unset.should.deepEqual({ salt: 1 });
          changes.$set.password.should.match(/^\$scrypt\$v=1\$/);
          changes.$set.should.not.have.property('authVersion');
          return { exec: async () => ({ matchedCount: 1 }) };
        });

      try {
        (await candidate.authenticate('legacy-password')).should.be.true();
        candidate.password.should.match(/^\$scrypt\$v=1\$/);
        should(candidate.salt).be.undefined();
        update.calledOnce.should.be.true();
      } finally {
        update.restore();
      }
    });

    it('rejects a legacy login when a concurrent password reset wins the CAS', async function () {
      const legacySalt = crypto.randomBytes(16);
      const legacyPassword = crypto
        .pbkdf2Sync('legacy-password', legacySalt, 10000, 64, 'sha1')
        .toString('base64');
      const candidate = new User({
        ...baseUser,
        password: legacyPassword,
        salt: legacySalt.toString('base64'),
      });
      const resetHash = await User.hashPassword('other-password');
      const update = sinon.stub(User, 'updateOne').returns({
        exec: async () => ({ matchedCount: 0 }),
      });
      const findById = sinon.stub(User, 'findById').returns({
        select() {
          return this;
        },
        lean() {
          return this;
        },
        exec: async () => ({ password: resetHash, salt: undefined }),
      });

      try {
        (await candidate.authenticate('legacy-password')).should.be.false();
        candidate.password.should.equal(legacyPassword);
        candidate.salt.should.equal(legacySalt.toString('base64'));
        update.calledOnce.should.be.true();
        findById.calledOnce.should.be.true();
      } finally {
        update.restore();
        findById.restore();
      }
    });

    it('accepts a legacy login when a concurrent upgrade already stored scrypt', async function () {
      const legacySalt = crypto.randomBytes(16);
      const legacyPassword = crypto
        .pbkdf2Sync('legacy-password', legacySalt, 10000, 64, 'sha1')
        .toString('base64');
      const candidate = new User({
        ...baseUser,
        password: legacyPassword,
        salt: legacySalt.toString('base64'),
      });
      const upgraded = await User.hashPassword('legacy-password');
      const update = sinon.stub(User, 'updateOne').returns({
        exec: async () => ({ matchedCount: 0 }),
      });
      const findById = sinon.stub(User, 'findById').returns({
        select() {
          return this;
        },
        lean() {
          return this;
        },
        exec: async () => ({ password: upgraded, salt: undefined }),
      });

      try {
        (await candidate.authenticate('legacy-password')).should.be.true();
        candidate.password.should.equal(upgraded);
        should(candidate.salt).be.undefined();
        update.calledOnce.should.be.true();
        findById.calledOnce.should.be.true();
      } finally {
        update.restore();
        findById.restore();
      }
    });
  });
});
