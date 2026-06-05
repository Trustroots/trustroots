/**
 * Unit tests for the profile controller's guard, validation and middleware
 * branches that the route tests do not exercise. Handlers are invoked directly
 * with mock req/res/next against the test database.
 */
const mongoose = require('mongoose');

const profileController = require('../../server/controllers/users.profile.server.controller');
const utils = require('../../../../testutils/server/data.server.testutil');
const should = require('should');

const User = mongoose.model('User');
const Tribe = mongoose.model('Tribe');

/**
 * Invoke a controller handler and resolve once it either responds or calls
 * `next`. Returns `{ res, nextCalled, nextArg }`.
 */
function runHandler(invoke) {
  return new Promise(resolve => {
    const res = { statusCode: 200, body: null };
    const finish = () =>
      resolve({ res, nextCalled: res._next, nextArg: res._nextArg });
    res.status = function (code) {
      res.statusCode = code;
      return res;
    };
    res.send = function (body) {
      res.body = body;
      finish();
      return res;
    };
    res.json = function (body) {
      res.body = body;
      finish();
      return res;
    };
    const next = arg => {
      res._next = true;
      res._nextArg = arg;
      finish();
    };
    invoke(res, next);
  });
}

describe('Profile controller unit tests', () => {
  afterEach(utils.clearDatabase);

  describe('update', () => {
    let userDoc;

    beforeEach(async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      userDoc = await User.findById(saved._id);
    });

    it('responds with 403 without a user', async () => {
      const { res } = await runHandler(res =>
        profileController.update({ body: {} }, res),
      );
      res.statusCode.should.equal(403);
    });

    it('rejects an invalid locale', async () => {
      const { res } = await runHandler(res =>
        profileController.update(
          { user: userDoc, body: { locale: 'not-a-locale' } },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('rejects a non-string nostrNpub', async () => {
      const { res } = await runHandler(res =>
        profileController.update(
          { user: userDoc, body: { nostrNpub: { evil: true } } },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('rejects an invalid nostrNpub', async () => {
      const { res } = await runHandler(res =>
        profileController.update(
          { user: userDoc, body: { nostrNpub: 'npub-not-valid' } },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('rejects an email already used by someone else', async () => {
      const [other] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      const otherDoc = await User.findById(other._id);

      const { res } = await runHandler(res =>
        profileController.update(
          { user: userDoc, body: { email: otherDoc.email }, login: () => {} },
          res,
        ),
      );
      res.statusCode.should.equal(403);
    });

    it('updates a simple field', async () => {
      const { res } = await runHandler(res =>
        profileController.update(
          {
            user: userDoc,
            body: { tagline: 'New tagline' },
            login: (user, cb) => cb(),
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);
      res.body.tagline.should.equal('New tagline');
    });

    it('allows resubmitting the same email address', async () => {
      const { res } = await runHandler(res =>
        profileController.update(
          {
            user: userDoc,
            body: { email: userDoc.email },
            login: (user, cb) => cb(),
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);
    });

    it('allows resubmitting a pending email change address', async () => {
      userDoc.emailTemporary = 'pending-change@example.com';
      await userDoc.save();

      const { res } = await runHandler(res =>
        profileController.update(
          {
            user: userDoc,
            body: { email: 'pending-change@example.com' },
            login: (user, cb) => cb(),
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);
    });

    it('returns 400 when login fails after saving', async () => {
      const { res } = await runHandler(res =>
        profileController.update(
          {
            user: userDoc,
            body: { tagline: 'Updated tagline' },
            login: (user, cb) => cb(new Error('login failed')),
          },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('changes the email and triggers a confirmation token', async () => {
      const { res } = await runHandler(res =>
        profileController.update(
          {
            user: userDoc,
            body: { email: 'brand-new-email@example.com' },
            login: (user, cb) => cb(),
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);

      const reloaded = await User.findById(userDoc._id);
      reloaded.emailTemporary.should.equal('brand-new-email@example.com');
      reloaded.emailToken.should.be.a.String();
    });
  });

  describe('initializeRemoveProfile', () => {
    it('responds with 403 without a user', async () => {
      const { res } = await runHandler(res =>
        profileController.initializeRemoveProfile({}, res),
      );
      res.statusCode.should.equal(403);
    });

    it('responds with 403 for suspended users', async () => {
      const { res } = await runHandler(res =>
        profileController.initializeRemoveProfile(
          {
            user: { _id: new mongoose.Types.ObjectId(), roles: ['suspended'] },
          },
          res,
        ),
      );
      res.statusCode.should.equal(403);
    });

    it('sends a removal confirmation email for a valid user', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);

      const { res } = await runHandler(res =>
        profileController.initializeRemoveProfile({ user: userDoc }, res),
      );

      res.statusCode.should.equal(200);
      res.body.message.should.containEql('email');

      const reloaded = await User.findById(saved._id);
      should.exist(reloaded.removeProfileToken);
      should.exist(reloaded.removeProfileExpires);
    });
  });

  describe('removeProfile', () => {
    it('responds with 403 without a user', async () => {
      const { res } = await runHandler(res =>
        profileController.removeProfile({}, res),
      );
      res.statusCode.should.equal(403);
    });

    it('responds with 400 for an invalid token', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const { res } = await runHandler(res =>
        profileController.removeProfile(
          { user: { _id: saved._id }, params: { token: 'invalid-token' } },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('removes the profile when the token is valid', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.removeProfileToken = 'valid-remove-token';
      userDoc.removeProfileExpires = Date.now() + 3600000;
      await userDoc.save();

      const { res } = await runHandler(res =>
        profileController.removeProfile(
          {
            user: { _id: saved._id },
            params: { token: 'valid-remove-token' },
          },
          res,
        ),
      );

      res.statusCode.should.equal(200);
      res.body.message.should.equal('Your profile has been removed.');

      const gone = await User.findById(saved._id);
      should.not.exist(gone);
    });
  });

  describe('getUser', () => {
    it('returns another user profile without the public field', async () => {
      const ownId = new mongoose.Types.ObjectId();
      const { res } = await runHandler(res =>
        profileController.getUser(
          {
            user: { _id: ownId },
            profile: { _id: new mongoose.Types.ObjectId(), public: true },
          },
          res,
        ),
      );
      (res.body.public === undefined).should.be.true();
    });

    it('returns the own profile', async () => {
      const id = new mongoose.Types.ObjectId();
      const { res } = await runHandler(res =>
        profileController.getUser(
          { user: { _id: id }, profile: { _id: id } },
          res,
        ),
      );
      res.body.should.be.an.Object();
    });

    it('returns an empty object without a profile', async () => {
      const { res } = await runHandler(res =>
        profileController.getUser(
          { user: { _id: new mongoose.Types.ObjectId() } },
          res,
        ),
      );
      res.body.should.deepEqual({});
    });
  });

  describe('getMiniUser', () => {
    it('returns the profile without public and roles', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const profile = await User.findById(saved._id);
      const { res } = await runHandler(res =>
        profileController.getMiniUser({ profile }, res),
      );
      (res.body.public === undefined).should.be.true();
      (res.body.roles === undefined).should.be.true();
    });

    it('returns an empty object without a profile', async () => {
      const { res } = await runHandler(res =>
        profileController.getMiniUser({}, res),
      );
      res.body.should.deepEqual({});
    });
  });

  describe('userMiniByID', () => {
    it('responds with 400 for an invalid id', async () => {
      const { res } = await runHandler((res, next) =>
        profileController.userMiniByID({ user: {} }, res, next, 'bad-id'),
      );
      res.statusCode.should.equal(400);
    });

    it('responds with 404 for a missing user', async () => {
      const { res } = await runHandler((res, next) =>
        profileController.userMiniByID(
          { user: { _id: new mongoose.Types.ObjectId(), roles: [] } },
          res,
          next,
          new mongoose.Types.ObjectId().toString(),
        ),
      );
      res.statusCode.should.equal(404);
    });

    it('responds with 404 for a suspended profile', async () => {
      const [viewer] = await utils.saveUsers(utils.generateUsers(1));
      const [target] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      const targetDoc = await User.findById(target._id);
      targetDoc.roles = ['suspended'];
      await targetDoc.save();

      const { res } = await runHandler((res, next) =>
        profileController.userMiniByID(
          { user: { _id: viewer._id, roles: ['user'] } },
          res,
          next,
          target._id.toString(),
        ),
      );
      res.statusCode.should.equal(404);
    });

    it('calls next for a valid public profile', async () => {
      const [viewer] = await utils.saveUsers(utils.generateUsers(1));
      const [target] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );

      const { nextCalled } = await runHandler((res, next) =>
        profileController.userMiniByID(
          { user: { _id: viewer._id, roles: ['user'] } },
          res,
          next,
          target._id.toString(),
        ),
      );
      nextCalled.should.be.true();
    });
  });

  describe('userByUsername', () => {
    it('responds with 403 without a user', async () => {
      const { res } = await runHandler((res, next) =>
        profileController.userByUsername({}, res, next, 'someusername'),
      );
      res.statusCode.should.equal(403);
    });

    it('responds with 400 for too short a username', async () => {
      const { res } = await runHandler((res, next) =>
        profileController.userByUsername({ user: {} }, res, next, 'ab'),
      );
      res.statusCode.should.equal(400);
    });

    it('responds with 404 for a missing username', async () => {
      const [viewer] = await utils.saveUsers(utils.generateUsers(1));
      const { res } = await runHandler((res, next) =>
        profileController.userByUsername(
          { user: { _id: viewer._id, roles: ['user'] } },
          res,
          next,
          'nosuchusername',
        ),
      );
      res.statusCode.should.equal(404);
    });

    it('calls next for an existing public profile', async () => {
      const [viewer] = await utils.saveUsers(utils.generateUsers(1));
      const [target] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      const targetDoc = await User.findById(target._id);

      const { nextCalled } = await runHandler((res, next) =>
        profileController.userByUsername(
          { user: { _id: viewer._id, roles: ['user'] } },
          res,
          next,
          targetDoc.username,
        ),
      );
      nextCalled.should.be.true();
    });

    it('responds with 404 when the profile owner has blocked the viewer', async () => {
      const [viewer, target] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const targetDoc = await User.findById(target._id);
      targetDoc.blocked = [viewer._id];
      await targetDoc.save();

      const { res } = await runHandler((res, next) =>
        profileController.userByUsername(
          {
            user: { _id: viewer._id, roles: ['user'], blocked: [] },
          },
          res,
          next,
          targetDoc.username,
        ),
      );
      res.statusCode.should.equal(404);
    });
  });

  describe('joinTribe and leaveTribe', () => {
    it('joinTribe responds with 403 without a user', async () => {
      const { res } = await runHandler(res =>
        profileController.joinTribe({ params: { tribeId: 'x' } }, res),
      );
      res.statusCode.should.equal(403);
    });

    it('joinTribe rejects an invalid tribe id', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const { res } = await runHandler(res =>
        profileController.joinTribe(
          { user: { _id: saved._id, member: [] }, params: { tribeId: 'bad' } },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('joinTribe rejects joining the same tribe twice', async () => {
      const tribe = await new Tribe({ label: 'Unit Tribe' }).save();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.member = [{ tribe: tribe._id, since: new Date() }];
      await userDoc.save();

      const { res } = await runHandler(res =>
        profileController.joinTribe(
          {
            user: userDoc,
            params: { tribeId: tribe._id.toString() },
          },
          res,
        ),
      );
      res.statusCode.should.equal(409);
    });

    it('leaveTribe rejects an invalid tribe id', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const { res } = await runHandler(res =>
        profileController.leaveTribe(
          {
            user: { _id: saved._id, member: [] },
            params: { tribeId: 'not-an-object-id' },
          },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('leaveTribe rejects leaving a tribe that no longer exists', async () => {
      const tribe = await new Tribe({ label: 'Deleted Tribe' }).save();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.member = [{ tribe: tribe._id, since: new Date() }];
      await userDoc.save();
      await Tribe.findByIdAndRemove(tribe._id);

      const { res } = await runHandler(res =>
        profileController.leaveTribe(
          {
            user: userDoc,
            params: { tribeId: tribe._id.toString() },
          },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('leaveTribe rejects leaving a tribe you do not belong to', async () => {
      const tribe = await new Tribe({ label: 'Leave Tribe' }).save();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const { res } = await runHandler(res =>
        profileController.leaveTribe(
          {
            user: { _id: saved._id, member: [] },
            params: { tribeId: tribe._id.toString() },
          },
          res,
        ),
      );
      res.statusCode.should.equal(409);
    });

    it('leaveTribe responds with 403 without a user', async () => {
      const tribe = await new Tribe({ label: 'No User Tribe' }).save();
      const { res } = await runHandler(res =>
        profileController.leaveTribe(
          { params: { tribeId: tribe._id.toString() } },
          res,
        ),
      );
      res.statusCode.should.equal(403);
    });

    it('joinTribe rejects a tribe that does not exist', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const { res } = await runHandler(res =>
        profileController.joinTribe(
          {
            user: { _id: saved._id, member: [] },
            params: { tribeId: new mongoose.Types.ObjectId().toString() },
          },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('joinTribe adds the user to a tribe', async () => {
      const tribe = await new Tribe({ label: 'Join Tribe' }).save();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.member = [];
      await userDoc.save();

      const { res } = await runHandler(res =>
        profileController.joinTribe(
          {
            user: userDoc,
            params: { tribeId: tribe._id.toString() },
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);
      res.body.message.should.equal('Joined tribe.');

      const reloaded = await User.findById(saved._id);
      reloaded.member.length.should.equal(1);
    });

    it('leaveTribe removes the user from a tribe', async () => {
      const tribe = await new Tribe({ label: 'Leave Success Tribe' }).save();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.member = [{ tribe: tribe._id, since: new Date() }];
      await userDoc.save();

      const { res } = await runHandler(res =>
        profileController.leaveTribe(
          {
            user: userDoc,
            params: { tribeId: tribe._id.toString() },
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);
      res.body.message.should.equal('Left tribe.');

      const reloaded = await User.findById(saved._id);
      reloaded.member.length.should.equal(0);
    });
  });

  describe('sanitizeProfile', () => {
    it('returns undefined for a missing profile', () => {
      (profileController.sanitizeProfile(null) === undefined).should.be.true();
    });

    it('marks active volunteers on the sanitized profile', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.roles = ['user', 'volunteer'];
      await userDoc.save();

      const sanitized = profileController.sanitizeProfile(userDoc, userDoc);
      sanitized.isVolunteer.should.be.true();
    });

    it('marks volunteer alumni on the sanitized profile', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.roles = ['user', 'volunteer-alumni'];
      await userDoc.save();

      const sanitized = profileController.sanitizeProfile(userDoc, userDoc);
      sanitized.isVolunteerAlumni.should.be.true();
      (sanitized.roles === undefined).should.be.true();
    });

    it('collects member tribe ids from unpopulated memberships', async () => {
      const tribe = await new Tribe({ label: 'ObjectId Tribe' }).save();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.member = [{ tribe: tribe._id, since: new Date() }];
      await userDoc.save();
      const plain = await User.findById(saved._id);

      const sanitized = profileController.sanitizeProfile(plain, plain);
      sanitized.memberIds.should.containEql(tribe._id.toString());
    });

    it('collects member tribe ids from populated memberships', async () => {
      const tribe = await new Tribe({ label: 'Sanitize Tribe' }).save();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.member = [{ tribe: tribe._id, since: new Date() }];
      await userDoc.save();
      const populated = await User.findById(saved._id).populate('member.tribe');

      const sanitized = profileController.sanitizeProfile(populated, populated);
      sanitized.memberIds.should.containEql(tribe._id.toString());
    });
  });

  describe('search middleware', () => {
    it('calls next when no search query is provided', async () => {
      let nextCalled = false;
      await new Promise(resolve => {
        profileController.search({ query: {} }, {}, () => {
          nextCalled = true;
          resolve();
        });
      });
      nextCalled.should.be.true();
    });

    it('rejects a search string that is too short', async () => {
      const { res } = await runHandler((res, next) =>
        profileController.search(
          { query: { search: 'ab' }, user: { blocked: [] } },
          res,
          next,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('returns matching public profiles', async () => {
      const [viewer, target] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const targetDoc = await User.findById(target._id);
      targetDoc.tagline = 'UniqueSearchableTagline';
      await targetDoc.save();

      const { res } = await runHandler((res, next) =>
        profileController.search(
          {
            query: { search: 'UniqueSearchable' },
            user: { _id: viewer._id, blocked: [] },
            skip: 0,
          },
          res,
          next,
        ),
      );
      res.statusCode.should.equal(200);
      res.body.should.be.an.Array();
    });
  });
});
