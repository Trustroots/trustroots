/**
 * Module dependencies.
 */
import type {
  UserModel,
  UserModelDocument,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';
const should: typeof import('should') = require('should');
const crypto: typeof import('node:crypto') = require('node:crypto');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const config: typeof import('../../../../config/config.mts').default = require('../../../../config/config.mts');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
const User = mongoose.model<UserRecord, UserModel>('User');
type TestUserDocument = UserModelDocument;
function assertPresent<T>(value: T | null | undefined): asserts value is T {
  should.exist(value);
  if (value === null || value === undefined) {
    throw new Error('Expected a value to be present');
  }
}
function present<T>(value: T | null | undefined): T {
  assertPresent(value);
  return value;
}
/**
 * Globals
 */
let user: TestUserDocument;
let user2: TestUserDocument;
let user3: Partial<UserRecord> &
  Pick<
    UserRecord,
    | 'firstName'
    | 'lastName'
    | 'displayName'
    | 'email'
    | 'username'
    | 'password'
    | 'provider'
  >;
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
      username: 'differentusername',
      password: 'different_password',
      provider: 'local',
    };
    User.init().then(() => done(), done);
  });
  afterEach(utils.clearDatabase);
  describe('Servas profile paths', function () {
    for (const path of [
      '',
      'household/fictional-host',
      'address/fictional-host',
      ' address/fictional-host ',
    ]) {
      it(`accepts the supported path ${JSON.stringify(path)}`, function () {
        const member = new User({ ...user3, extSitesServas: path });
        should.not.exist(member.validateSync()?.errors.extSitesServas);
        present(member.extSitesServas).should.equal(path.trim());
      });
    }
    for (const path of [
      'https://example.test/host',
      'user/fictional-host',
      'household/',
      'address/host name',
      'address/host?query=1',
      'address/host#fragment',
      'address/host\\other',
    ]) {
      it(`rejects the unsupported path ${JSON.stringify(path)}`, function () {
        const member = new User({ ...user3, extSitesServas: path });
        should.exist(member.validateSync()?.errors.extSitesServas);
      });
    }
  });
  describe('Default profile image source', function () {
    it('defaults new accounts to no photo and allows explicit Gravatar selection', function () {
      const member = new User();
      present(member.avatarSource).should.equal('none');
      member.avatarSource = 'gravatar';
      present(member.avatarSource).should.equal('gravatar');
    });
  });
  describe('Retired Facebook avatars', function () {
    it('normalises stored selections and allows unrelated profile saves', async function () {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      await User.collection.updateOne(
        { _id: saved._id },
        { $set: { avatarSource: 'facebook' } },
      );
      const legacy = await User.findById(saved._id);
      assertPresent(legacy);
      present(legacy.avatarSource).should.equal('none');
      legacy.tagline = 'A fictional member updates their profile';
      await legacy.save();
      const reloaded = await User.findById(saved._id);
      assertPresent(reloaded);
      assertPresent(reloaded.tagline);
      reloaded.tagline.should.equal(legacy.tagline);
      present(reloaded.avatarSource).should.equal('none');
    });
    it('rejects new Facebook avatar selections', async function () {
      const member = new User(utils.generateUsers(1)[0]);
      member.avatarSource = 'facebook';
      const error = member.validateSync();
      assertPresent(error);
      error.errors.avatarSource.kind.should.equal('enum');
    });
  });
  describe('Method Save', function () {
    it('should begin with no users', function (done) {
      User.find({})
        .then((users: TestUserDocument[]) => {
          users.should.have.length(0);
          done();
        })
        .catch(done);
    });
    it('should be able to save without problems', function (done) {
      const _user = new User(user);
      _user
        .save()
        .then(() => {
          should.not.exist(null);
          done();
        })
        .catch(done);
    });
    it('should fail to save an existing user again', function (done) {
      const _user = new User(user);
      const _user2 = new User(user2);
      _user
        .save()
        .then(function () {
          _user2
            .save()
            .then(
              () => {
                throw new Error('Expected the operation to reject');
              },
              err => {
                should.exist(err);
                done();
              },
            )
            .catch(done);
        })
        .catch(done);
    });
    it('should be able to generate displayName when saving user', function (done) {
      const _user = new User(user);
      _user.firstName = 'Test';
      _user
        .save()
        .then(savedUser => {
          savedUser.firstName.should.equal('Test');
          savedUser.lastName.should.equal('Name');
          present(savedUser.displayName).should.equal('Test Name');
          done();
        })
        .catch(done);
    });
    it('should be able to generate displayName when updating user', function (done) {
      const _user = new User(user);
      // Create user
      _user
        .save()
        .then(() => {
          // Re-save the user we just created, but with new first name
          _user.firstName = 'Test';
          _user
            .save()
            .then(savedUser2 => {
              savedUser2.firstName.should.equal('Test');
              savedUser2.lastName.should.equal('Name');
              present(savedUser2.displayName).should.equal('Test Name');
              done();
            })
            .catch(done);
        })
        .catch(done);
    });
    it('should be able to show an error when try to save without first name', function (done) {
      const _user = new User(user);
      _user.firstName = '';
      _user
        .save()
        .then(
          () => {
            throw new Error('Expected the operation to reject');
          },
          err => {
            should.exist(err);
            done();
          },
        )
        .catch(done);
    });
    it('should be able to show an error when try to save with too short password', function (done) {
      const _user = new User(user);
      _user.password = 's1';
      _user
        .save()
        .then(
          () => {
            throw new Error('Expected the operation to reject');
          },
          err => {
            should.exist(err);
            done();
          },
        )
        .catch(done);
    });
    it('should confirm that saving user model doesnt change the password', function (done) {
      const _user = new User(user);
      _user
        .save()
        .then(() => {
          should.not.exist(null);
          const passwordBefore = present(_user.password);
          _user.firstName = 'test';
          _user
            .save()
            .then(() => {
              should.not.exist(null);
              const passwordAfter = _user.password;
              passwordBefore.should.equal(passwordAfter);
              done();
            })
            .catch(done);
        })
        .catch(done);
    });
    it('should be able to save 2 different users', function (done) {
      const _user = new User(user);
      const _user3 = new User(user3);
      _user
        .save()
        .then(() => {
          should.not.exist(null);
          _user3
            .save()
            .then(() => {
              should.not.exist(null);
              done();
            })
            .catch(done);
        })
        .catch(done);
    });
    it('should not be able to save different user with the same email address', async function () {
      const _user = new User(user);
      const _user3 = new User(user3);
      await _user.deleteOne();
      await _user.save();
      const user3Email = _user3.email;
      _user3.email = _user.email;
      try {
        await _user3.save();
        throw new Error('Expected the operation to reject');
      } catch (err) {
        if (
          err instanceof Error &&
          err.message === 'Expected the operation to reject'
        ) {
          throw err;
        }
        assertPresent(err);
        if (!(err instanceof mongoose.Error.ValidationError)) throw err;
        err.errors.email.message.should.equal(
          'Account with this email exists already.',
        );
        _user3.email = user3Email;
      }
    });
    it('should not be able to save different user with the same username', async function () {
      const _user = new User(user);
      const _user3 = new User(user3);
      await _user.deleteOne();
      await _user.save();
      const user3Username = _user3.username;
      _user3.username = _user.username;
      try {
        await _user3.save();
        throw new Error('Expected the operation to reject');
      } catch (err) {
        if (
          err instanceof Error &&
          err.message === 'Expected the operation to reject'
        ) {
          throw err;
        }
        assertPresent(err);
        if (!(err instanceof mongoose.Error.ValidationError)) throw err;
        err.errors.username.message.should.equal('Username exists already.');
        _user3.username = user3Username;
      }
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
        should(err).be.instanceof(mongoose.Error.ValidationError);
        if (!(err instanceof mongoose.Error.ValidationError)) throw err;
        err.errors.email?.message.should.equal(
          'Account with this email exists already.',
        );
      }
      const stored = await User.findById(second._id);
      assertPresent(stored);
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
        should(err).be.instanceof(mongoose.Error.ValidationError);
        if (!(err instanceof mongoose.Error.ValidationError)) throw err;
        err.errors.username?.message.should.equal('Username exists already.');
      }
      const stored = await User.findById(second._id);
      assertPresent(stored);
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
    it('should show error to save username beginning with .', function (done) {
      const _user = new User(user);
      _user.username = '.login';
      _user
        .save()
        .then(
          () => {
            throw new Error('Expected the operation to reject');
          },
          err => {
            should.exist(err);
            done();
          },
        )
        .catch(done);
    });
    it('should be able to show an error when try to save with not allowed username', function (done) {
      const _user = new User(user);
      _user.username =
        config.illegalStrings[
          Math.floor(Math.random() * config.illegalStrings.length)
        ];
      _user
        .save()
        .then(
          () => {
            throw new Error('Expected the operation to reject');
          },
          err => {
            should.exist(err);
            done();
          },
        )
        .catch(done);
    });
    it('should show error to save username end with .', function (done) {
      const _user = new User(user);
      _user.username = 'login.';
      _user
        .save()
        .then(
          () => {
            throw new Error('Expected the operation to reject');
          },
          err => {
            should.exist(err);
            done();
          },
        )
        .catch(done);
    });
    it('should show error to save username with ..', function (done) {
      const _user = new User(user);
      _user.username = 'log..in';
      _user
        .save()
        .then(
          () => {
            throw new Error('Expected the operation to reject');
          },
          err => {
            should.exist(err);
            done();
          },
        )
        .catch(done);
    });
    it('should show error to save username shorter than 3 character', function (done) {
      const _user = new User(user);
      _user.username = 'lo';
      _user
        .save()
        .then(
          () => {
            throw new Error('Expected the operation to reject');
          },
          err => {
            should.exist(err);
            done();
          },
        )
        .catch(done);
    });
    it('should show error saving a username without at least one alphanumeric character', function (done) {
      const _user = new User(user);
      _user.username = '-_-';
      _user
        .save()
        .then(
          () => {
            throw new Error('Expected the operation to reject');
          },
          err => {
            should.exist(err);
            done();
          },
        )
        .catch(done);
    });
    it('should show error saving a username longer than 34 characters', function (done) {
      const _user = new User(user);
      _user.username = 'l'.repeat(35);
      _user
        .save()
        .then(
          () => {
            throw new Error('Expected the operation to reject');
          },
          err => {
            should.exist(err);
            done();
          },
        )
        .catch(done);
    });
    it('should reject a new username with dot', function (done) {
      const _user = new User(user);
      _user.username = 'log.in';
      _user
        .save()
        .then(
          () => {
            throw new Error('Expected the operation to reject');
          },
          err => {
            should.exist(err);
            done();
          },
        )
        .catch(done);
    });
  });
  describe('Roles Validation', function () {
    it('should show error when trying to save with non-existing role', function (done) {
      const _user = new User(user);
      _user.roles = ['nope'];
      _user
        .save()
        .then(
          () => {
            throw new Error('Expected the operation to reject');
          },
          err => {
            should.exist(err);
            done();
          },
        )
        .catch(done);
    });
    it('should save without any roles', function (done) {
      const _user = new User(user);
      _user.roles = [];
      _user
        .save()
        .then(() => {
          should.not.exist(null);
          done();
        })
        .catch(done);
    });
    it('should save with "user" role', function (done) {
      const _user = new User(user);
      _user.roles = ['user'];
      _user
        .save()
        .then(() => {
          should.not.exist(null);
          done();
        })
        .catch(done);
    });
    it('should save with "admin" role', function (done) {
      const _user = new User(user);
      _user.roles = ['admin'];
      _user
        .save()
        .then(() => {
          should.not.exist(null);
          done();
        })
        .catch(done);
    });
    it('should tolerate legacy "moderator" role', function (done) {
      const _user = new User(user);
      _user.roles = ['moderator'];
      _user
        .save()
        .then(() => {
          should.not.exist(null);
          done();
        })
        .catch(done);
    });
    it('should save with "shadowban" role', function (done) {
      const _user = new User(user);
      _user.roles = ['shadowban'];
      _user
        .save()
        .then(() => {
          should.not.exist(null);
          done();
        })
        .catch(done);
    });
    it('should save with "suspended" role', function (done) {
      const _user = new User(user);
      _user.roles = ['suspended'];
      _user
        .save()
        .then(() => {
          should.not.exist(null);
          done();
        })
        .catch(done);
    });
    it('should save with multiple roles', function (done) {
      const _user = new User(user);
      _user.roles = ['user', 'admin'];
      _user
        .save()
        .then(() => {
          should.not.exist(null);
          done();
        })
        .catch(done);
    });
  });
  describe('Language Validation', function () {
    it('should show error when trying to save with non-existing language code', function (done) {
      const _user = new User(user);
      _user.languages = ['nope'];
      _user
        .save()
        .then(
          () => {
            throw new Error('Expected the operation to reject');
          },
          err => {
            should.exist(err);
            done();
          },
        )
        .catch(done);
    });
    it('should save without any languages', function (done) {
      const _user = new User(user);
      _user.languages = [];
      _user
        .save()
        .then(() => {
          should.not.exist(null);
          done();
        })
        .catch(done);
    });
    it('should save with valid language codes', function (done) {
      const _user = new User(user);
      _user.languages = ['fin', 'iso_639_3-vsi'];
      _user
        .save()
        .then(() => {
          should.not.exist(null);
          done();
        })
        .catch(done);
    });
  });
  describe('Password hash migration', function () {
    const baseUser = {
      firstName: 'Anonymous',
      lastName: 'Traveller',
      email: 'hash-migration@example.org',
      username: 'hashmigrationuser',
      provider: 'local',
    };
    it('hashes modified plaintext with scrypt and clears the separate salt', async function () {
      const candidate = new User({ ...baseUser, password: 'new-password-123' });
      await candidate.save();
      present(candidate.password).should.match(/^\$scrypt\$v=1\$/);
      should(candidate.salt).be.undefined();
      (await candidate.authenticate('new-password-123')).should.be.true();
      (await candidate.authenticate('wrong-password')).should.be.false();
    });
    it('hashes a password that resembles a tagged hash as plaintext on save', async function () {
      const supplied = '$scrypt$v=1$ln=17,r=8,p=1$not-a-salt$not-a-key';
      const candidate = new User({ ...baseUser, password: supplied });
      await candidate.save();
      present(candidate.password).should.not.equal(supplied);
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
      const update = sinon.stub(
        User,
        'updateOne',
      ) as unknown as import('sinon').SinonStub<
        Parameters<
          import('../../../../testutils/server/model-contracts.mts').UserUpdateOne
        >,
        ReturnType<
          import('../../../../testutils/server/model-contracts.mts').UserUpdateOne
        >
      >;
      update.callsFake((filter, changes) => {
        if (!filter || !changes || '$set' in changes === false) {
          throw new Error('Expected a password upgrade update');
        }
        filter.password.should.equal(legacyPassword);
        filter.salt.should.equal(legacySalt.toString('base64'));
        present(filter.$or).should.deepEqual([
          { authVersion: { $exists: false } },
          { authVersion: 0 },
        ]);
        present(changes.$unset).should.deepEqual({ salt: 1 });
        present(changes.$set).password.should.match(/^\$scrypt\$v=1\$/);
        present(changes.$set).should.not.have.property('authVersion');
        return {
          exec: async () => ({
            acknowledged: true,
            matchedCount: 1,
            modifiedCount: 0,
            upsertedCount: 0,
            upsertedId: null,
          }),
        } as unknown as ReturnType<typeof User.updateOne>;
      });
      try {
        (await candidate.authenticate('legacy-password')).should.be.true();
        present(candidate.password).should.match(/^\$scrypt\$v=1\$/);
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
        exec: async () => ({
          acknowledged: true,
          matchedCount: 0,
          modifiedCount: 0,
          upsertedCount: 0,
          upsertedId: null,
        }),
      } as unknown as ReturnType<typeof User.updateOne>);
      const findById = sinon.stub(User, 'findById').returns({
        select() {
          return this;
        },
        lean() {
          return this;
        },
        exec: async () => ({ password: resetHash, salt: undefined }),
      } as unknown as ReturnType<typeof User.findById>);
      try {
        (await candidate.authenticate('legacy-password')).should.be.false();
        present(candidate.password).should.equal(legacyPassword);
        should(candidate.salt).equal(legacySalt.toString('base64'));
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
        exec: async () => ({
          acknowledged: true,
          matchedCount: 0,
          modifiedCount: 0,
          upsertedCount: 0,
          upsertedId: null,
        }),
      } as unknown as ReturnType<typeof User.updateOne>);
      const findById = sinon.stub(User, 'findById').returns({
        select() {
          return this;
        },
        lean() {
          return this;
        },
        exec: async () => ({ password: upgraded, salt: undefined }),
      } as unknown as ReturnType<typeof User.findById>);
      try {
        (await candidate.authenticate('legacy-password')).should.be.true();
        present(candidate.password).should.equal(upgraded);
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
