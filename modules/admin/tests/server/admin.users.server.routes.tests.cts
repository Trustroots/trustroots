const mongoose: typeof import('mongoose') = require('mongoose');
const request: typeof import('supertest') = require('supertest');
const sinon: typeof import('sinon') = require('sinon');
const should: typeof import('should') = require('should');
const express: import('../../../../testutils/server/model-contracts.mts').TestExpressModule = require('./../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
type UserRecord =
  import('../../../../testutils/server/model-contracts.mts').UserRecord;
type UserModel =
  import('../../../../testutils/server/model-contracts.mts').UserModel;
type Credentials =
  import('../../../../testutils/server/model-contracts.mts').Credentials;
type TestExpressApp =
  import('../../../../testutils/server/model-contracts.mts').TestExpressApp;
type TestAgent =
  import('../../../../testutils/server/model-contracts.mts').TestAgent;
const User = mongoose.model<UserRecord, UserModel>('User');
const AuditLog = mongoose.model<{
  body?: {
    reason?: string;
    keywords?: string[];
    confirmEmpty?: boolean;
    revision?: number;
    rules?: unknown[];
  };
}>('AuditLog');
const SignupReviewRules = mongoose.model('SignupReviewRules');
const UnifiedPushRegistration = mongoose.model('UnifiedPushRegistration');

interface AdminUserSummary {
  username: string;
  displayName?: string;
  email?: string;
  lastIpHash?: string;
  password?: string;
  salt?: string;
  removeProfileToken?: string;
  resetPasswordToken?: string;
}
interface PotentialAdminUser extends AdminUserSummary {
  matchReasons: string[];
  acquisitionStory?: string;
}

/**
 * Globals
 */
let credentialsAdmin: Credentials;
let credentialsRegular: Credentials;
let userAdmin: import('../../../../testutils/server/model-contracts.mts').UserModelDocument;
let userAdminId: string;
let userRegular: import('../../../../testutils/server/model-contracts.mts').UserModelDocument;
let userRegularId: string;
describe('Admin User CRUD tests', () => {
  // Get application
  let app: TestExpressApp;
  let agent: TestAgent;
  before(async function () {
    app = await express.init(mongoose.connection);
    agent = request.agent(app);
  });
  beforeEach(async () => {
    // Create admin credentials
    credentialsAdmin = {
      username: 'useradmin',
      password: 'Password123!',
    };

    // Create regular user credentials
    credentialsRegular = {
      username: 'userregular',
      password: 'Password123!',
    };

    // Create a new admin user
    userAdmin = new User({
      displayName: 'Admin Name',
      email: 'admin@example.com',
      emailToken: 'test-token',
      firstName: 'Admin',
      lastName: 'Name',
      member: [],
      provider: 'local',
      public: true,
      removeProfileToken: 'test-token',
      resetPasswordToken: 'test-token',
      roles: ['user', 'admin'],
      ...credentialsAdmin,
    });

    // Create a new regular user
    userRegular = new User({
      displayName: 'Full Name',
      email: 'regular@example.com',
      emailToken: 'test-token',
      firstName: 'Full',
      lastName: 'Name',
      member: [],
      provider: 'local',
      public: true,
      removeProfileToken: 'test-token',
      resetPasswordToken: 'test-token',
      roles: ['user'],
      created: new Date(),
      ...credentialsRegular,
    });
    const { _id: _userAdminId } = await userAdmin.save();
    userAdminId = _userAdminId.toString();
    const { _id: _userRegularId } = await userRegular.save();
    userRegularId = _userRegularId.toString();
  });
  afterEach(utils.clearDatabase);
  describe('As non-authenticated user...', () => {
    it('Non-authenticated users should not be allowed to search users', async () => {
      await agent
        .post('/api/admin/users')
        .send({
          search: 'Name',
        })
        .expect(403);
    });
    it('Non-authenticated users should not be allowed to list users by role', async () => {
      await agent
        .post('/api/admin/users/by-role')
        .send({
          role: 'admin',
        })
        .expect(403);
    });
    it('Non-authenticated users should not be allowed to list users by IP address', async () => {
      await agent
        .post('/api/admin/users/by-last-ip-hash')
        .send({
          ipHash:
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        })
        .expect(403);
    });
    it('Mon-authenticated users should not be allowed to get user by ID', async () => {
      await agent
        .post('/api/admin/user')
        .send({
          id: userRegularId,
        })
        .expect(403);
    });
    it('Non-authenticated users should not be allowed to change user roles', async () => {
      await agent
        .post('/api/admin/user/change-role')
        .send({
          id: userRegularId,
          role: 'suspended',
        })
        .expect(403);
    });
    it('Non-authenticated users should not be allowed to delete users', async () => {
      await agent
        .post('/api/admin/user/delete')
        .send({ id: userRegularId, username: 'userregular', reason: 'test' })
        .expect(403);
    });
    it('Non-authenticated users should not be allowed to change user roles', async () => {
      await agent
        .post('/api/admin/user/change-role')
        .send({
          id: userRegularId,
          role: 'suspended',
        })
        .expect(403);
    });
  });
  describe('As authenticated user...', () => {
    afterEach(async () => {
      await utils.signOut(agent);
    });
    describe('Search users', () => {
      it('non-admin users should not be allowed to search', async () => {
        await utils.signIn(credentialsRegular, agent);
        await agent
          .post('/api/admin/users')
          .send({
            search: 'Name',
          })
          .expect(403);
      });
      it('admin users should be allowed to search and get correct results', async () => {
        await utils.signIn(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/users')
          .send({
            search: 'Name',
          })
          .expect(200);
        const { users } = body;
        should(users.length).equal(2);
        should(body.pagination.total).equal(2);
        should(body.sort).deepEqual({
          column: 'username',
          direction: 'ascending',
        });
        should.exist(users[0].created);
        should.exist(users[1].created);
        should(users[0].username).equal('useradmin');
        should(users[1].username).equal('userregular');
        users.forEach((user: AdminUserSummary) => {
          // These should have been removed
          should.not.exist(user.password);
          should.not.exist(user.salt);
          // These should have been obfuscated
          should(user.removeProfileToken).equal('(Hidden from admins.)');
          should(user.resetPasswordToken).equal('(Hidden from admins.)');
        });
      });
      it('should find by username', async () => {
        await utils.signIn(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/users')
          .send({
            search: 'userregular',
          })
          .expect(200);
        should(body.users.length).equal(1);
        should(body.users[0].username).equal('userregular');
      });
      it('should sort matching users on the server', async () => {
        await utils.signIn(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/users')
          .send({
            search: 'Name',
            sort: {
              column: 'displayName',
              direction: 'descending',
            },
          })
          .expect(200);
        should(
          body.users.map((user: AdminUserSummary) => user.displayName),
        ).deepEqual(['Full Name', 'Admin Name']);
        should(body.sort).deepEqual({
          column: 'displayName',
          direction: 'descending',
        });
      });
      it('should trim surrounding whitespace from a search query', async () => {
        await utils.signIn(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/users')
          .send({
            search: '  userregular  ',
          })
          .expect(200);
        should(body.users.length).equal(1);
        should(body.users[0].username).equal('userregular');
      });
      it('should ignore whitespace between search words', async () => {
        await utils.signIn(credentialsAdmin, agent);
        await new User({
          displayName: 'Spaceless Member',
          email: 'spaceless-member@example.test',
          firstName: 'Spaceless',
          lastName: 'Member',
          member: [],
          password: 'Password123!',
          provider: 'local',
          public: true,
          roles: ['user'],
          username: 'spacelessmember',
        }).save();
        const { body } = await agent
          .post('/api/admin/users')
          .send({
            search: 'spaceless member',
          })
          .expect(200);
        should(body.users.length).equal(1);
        should(body.users[0].username).equal('spacelessmember');
      });
      it('should find by email', async () => {
        await utils.signIn(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/users')
          .send({
            search: 'regular@example.com',
          })
          .expect(200);
        should(body.users.length).equal(1);
        should(body.users[0].email).equal('regular@example.com');
      });
    });
    it('non-admin users should not be allowed to delete users', async () => {
      await utils.signIn(credentialsRegular, agent);
      await agent
        .post('/api/admin/user/delete')
        .send({ id: userRegularId, username: 'userregular', reason: 'test' })
        .expect(403);
    });
    it('only administrators can read or update signup review rules', async () => {
      await agent.get('/api/admin/signup-review-rules').expect(403);
      await agent
        .put('/api/admin/signup-review-rules')
        .send({ revision: 0, rules: [] })
        .expect(403);
      await utils.signIn(credentialsRegular, agent);
      await agent.get('/api/admin/signup-review-rules').expect(403);
      await agent
        .put('/api/admin/signup-review-rules')
        .send({ revision: 0, rules: [] })
        .expect(403);
    });
    it('normalises and audits signup review rule updates with optimistic concurrency', async () => {
      await utils.signIn(credentialsAdmin, agent);
      const initial = await agent
        .get('/api/admin/signup-review-rules')
        .expect(200);
      const payload = {
        revision: initial.body.revision,
        rules: [
          { kind: 'keyword', value: '  Fictional Phrase ' },
          { kind: 'email', value: ' Person@Example.org ' },
          { kind: 'domain', value: ' Example.org ' },
        ],
      };
      const saved = await agent
        .put('/api/admin/signup-review-rules')
        .send(payload)
        .expect(200);
      saved.body.revision.should.equal(initial.body.revision + 1);
      saved.body.rules.should.deepEqual([
        { kind: 'keyword', value: 'fictional phrase' },
        { kind: 'email', value: 'person@example.org' },
        { kind: 'domain', value: 'example.org' },
      ]);
      await agent
        .put('/api/admin/signup-review-rules')
        .send(payload)
        .expect(409);
      (
        await AuditLog.countDocuments({
          route: '/api/admin/signup-review-rules',
        })
      ).should.equal(1);
    });
    it('requires explicit confirmation to clear every signup review rule', async () => {
      await utils.signIn(credentialsAdmin, agent);
      const initial = await agent
        .get('/api/admin/signup-review-rules')
        .expect(200);
      const empty = { revision: initial.body.revision, rules: [] };
      await agent.put('/api/admin/signup-review-rules').send(empty).expect(400);
      should.equal(
        await SignupReviewRules.findById('signup-review').lean(),
        null,
      );
      (
        await AuditLog.countDocuments({
          route: '/api/admin/signup-review-rules',
        })
      ).should.equal(0);

      const cleared = await agent
        .put('/api/admin/signup-review-rules')
        .send({ ...empty, confirmEmpty: true })
        .expect(200);
      cleared.body.rules.should.deepEqual([]);
      const audit = await AuditLog.findOne({
        route: '/api/admin/signup-review-rules',
      }).lean();
      should.exist(audit);
      audit?.body?.confirmEmpty!.should.equal(true);
      audit?.body?.rules!.should.deepEqual([]);
    });
    it('rejects invalid rules, fails closed on an update race, and does not update when audit logging fails', async () => {
      await utils.signIn(credentialsAdmin, agent);
      const initial = await agent
        .get('/api/admin/signup-review-rules')
        .expect(200);
      for (const rules of [
        [
          { kind: 'keyword', value: 'duplicate' },
          { kind: 'keyword', value: ' DUPLICATE ' },
        ],
        [{ kind: 'email', value: 'invalid' }],
        Array(501).fill({ kind: 'keyword', value: 'phrase' }),
      ])
        await agent
          .put('/api/admin/signup-review-rules')
          .send({ revision: initial.body.revision, rules })
          .expect(400);

      sinon
        .stub(AuditLog.prototype, 'save')
        .rejects(new Error('audit unavailable'));
      try {
        await agent
          .put('/api/admin/signup-review-rules')
          .send({
            revision: initial.body.revision,
            rules: [{ kind: 'keyword', value: 'new phrase' }],
          })
          .expect(500);
      } finally {
        sinon.restore();
      }
      should.equal(
        await SignupReviewRules.findById('signup-review').lean(),
        null,
      );

      const current = await agent
        .get('/api/admin/signup-review-rules')
        .expect(200);
      sinon.stub(SignupReviewRules, 'findOneAndUpdate').resolves(null);
      try {
        await agent
          .put('/api/admin/signup-review-rules')
          .send({
            revision: current.body.revision,
            rules: [{ kind: 'keyword', value: 'concurrent phrase' }],
          })
          .expect(409);
      } finally {
        sinon.restore();
      }
    });
    describe('Delete suspended users', () => {
      it('requires an exact username and a non-empty reason', async () => {
        await utils.signIn(credentialsAdmin, agent);
        userRegular.roles = [...(userRegular.roles || []), 'suspended'];
        await userRegular.save();
        const invalid = [
          { id: userRegularId, username: 'wrongname', reason: 'reviewed' },
          { id: userRegularId, username: 'userregular', reason: '  ' },
          {
            id: userRegularId,
            username: 'userregular',
            reason: 'x'.repeat(1001),
          },
          { id: 'bad-id', username: 'userregular', reason: 'reviewed' },
          {
            id: userRegularId,
            username: 'userregular',
            reason: 'reviewed',
            keywords: ['  '],
          },
          {
            id: userRegularId,
            username: 'userregular',
            reason: 'reviewed',
            keywords: Array(21).fill('tag'),
          },
          {
            id: userRegularId,
            username: 'userregular',
            reason: 'reviewed',
            keywords: ['x'.repeat(81)],
          },
        ];
        for (const body of invalid)
          await agent.post('/api/admin/user/delete').send(body).expect(400);
        should.exist(await User.findById(userRegularId));
        (
          await AuditLog.countDocuments({ route: '/api/admin/user/delete' })
        ).should.equal(0);
      });

      it('deletes a suspended member after saving the reason and trimmed keywords to the audit log', async () => {
        await utils.signIn(credentialsAdmin, agent);
        userRegular.roles = [...(userRegular.roles || []), 'suspended'];
        await userRegular.save();
        await agent
          .post('/api/admin/user/delete')
          .send({
            id: userRegularId,
            username: 'userregular',
            reason: '  repeated abuse  ',
            keywords: ['  abuse ', ' repeat '],
          })
          .expect(200);

        should.not.exist(await User.findById(userRegularId));
        const audit = await AuditLog.findOne({
          route: '/api/admin/user/delete',
        }).lean();
        should.exist(audit);
        if (!audit) throw new Error('Expected deletion audit record');
        audit.body?.reason!.should.equal('repeated abuse');
        audit.body?.keywords!.should.deepEqual(['abuse', 'repeat']);
      });

      it('protects the acting administrator, other administrators, active users, and missing members', async () => {
        await utils.signIn(credentialsAdmin, agent);
        const payload = { username: 'useradmin', reason: 'reviewed' };
        await agent
          .post('/api/admin/user/delete')
          .send({ ...payload, id: userAdminId })
          .expect(403);
        await agent
          .post('/api/admin/user/delete')
          .send({ ...payload, id: userRegularId })
          .expect(409);
        await agent
          .post('/api/admin/user/delete')
          .send({ ...payload, id: '000000000000000000000001' })
          .expect(404);

        userRegular.roles = [
          ...(userRegular.roles || []),
          'admin',
          'suspended',
        ];
        await userRegular.save();
        await agent
          .post('/api/admin/user/delete')
          .send({
            id: userRegularId,
            username: 'userregular',
            reason: 'reviewed',
          })
          .expect(409);
      });

      it('does not delete the member if audit logging fails', async () => {
        await utils.signIn(credentialsAdmin, agent);
        userRegular.roles = [...(userRegular.roles || []), 'suspended'];
        await userRegular.save();
        sinon
          .stub(AuditLog.prototype, 'save')
          .rejects(new Error('audit unavailable'));
        try {
          await agent
            .post('/api/admin/user/delete')
            .send({
              id: userRegularId,
              username: 'userregular',
              reason: 'reviewed',
            })
            .expect(500);
          should.exist(await User.findById(userRegularId));
        } finally {
          sinon.restore();
        }
      });

      it('fails closed if the member changes between the lookup and atomic deletion', async () => {
        await utils.signIn(credentialsAdmin, agent);
        userRegular.roles = [...(userRegular.roles || []), 'suspended'];
        await userRegular.save();
        sinon.stub(User, 'findOneAndDelete').resolves(null);
        try {
          await agent
            .post('/api/admin/user/delete')
            .send({
              id: userRegularId,
              username: 'userregular',
              reason: 'reviewed',
            })
            .expect(500);
          should.exist(await User.findById(userRegularId));
          (
            await AuditLog.countDocuments({ route: '/api/admin/user/delete' })
          ).should.equal(1);
        } finally {
          sinon.restore();
        }
      });

      it('reports lookup failures without writing an audit record', async () => {
        await utils.signIn(credentialsAdmin, agent);
        sinon.stub(User, 'findById').rejects(new Error('lookup unavailable'));
        try {
          await agent
            .post('/api/admin/user/delete')
            .send({
              id: userRegularId,
              username: 'userregular',
              reason: 'reviewed',
            })
            .expect(500);
          (
            await AuditLog.countDocuments({ route: '/api/admin/user/delete' })
          ).should.equal(0);
        } finally {
          sinon.restore();
        }
      });

      it('reports cleanup rejection after the account has been atomically removed', async () => {
        await utils.signIn(credentialsAdmin, agent);
        userRegular.roles = [...(userRegular.roles || []), 'suspended'];
        await userRegular.save();
        const files: typeof import('../../../core/server/services/file-removal.server.service.mjs') = require('../../../core/server/services/file-removal.server.service.mjs');
        const offers: typeof import('../../../offers/server/controllers/offers.server.controller.mjs') = require('../../../offers/server/controllers/offers.server.controller.mjs');
        const contacts: typeof import('../../../contacts/server/controllers/contacts.server.controller.mjs') = require('../../../contacts/server/controllers/contacts.server.controller.mjs');
        const messages: typeof import('../../../messages/server/controllers/messages.server.controller.mjs') = require('../../../messages/server/controllers/messages.server.controller.mjs');
        const tribes: typeof import('../../../tribes/server/controllers/tribes.server.controller.mjs') = require('../../../tribes/server/controllers/tribes.server.controller.mjs');
        const email: typeof import('../../../core/server/services/email.server.service.mjs') = require('../../../core/server/services/email.server.service.mjs');
        sinon
          .stub(files, 'removeLocalPath')
          .rejects(new Error('cleanup failed'));
        sinon
          .stub(UnifiedPushRegistration, 'deleteMany')
          .rejects(new Error('push cleanup failed'));
        const offerCleanup = sinon
          .stub(offers, 'removeAllByUserId')
          .callsFake((_id, callback) =>
            callback?.(new Error('offer cleanup failed')),
          );
        const contactCleanup = sinon
          .stub(contacts, 'removeAllByUserId')
          .callsFake((_id, callback) =>
            callback?.(new Error('contact cleanup failed')),
          );
        const messageCleanup = sinon
          .stub(messages, 'markAllMessagesToUserNotified')
          .callsFake((_id, callback) =>
            callback(new Error('message cleanup failed')),
          );
        const tribe = await mongoose
          .model('Tribe')
          .create({ label: 'Cleanup test circle' });
        userRegular.member = [{ tribe: tribe._id, since: new Date() }];
        await userRegular.save();
        const circleCleanup = sinon
          .stub(tribes, 'updateCount')
          .callsFake((_tribe, _count, _create, callback) =>
            callback(new Error('circle cleanup failed')),
          );
        const confirmationEmail = sinon.spy(
          email,
          'sendRemoveProfileConfirmed',
        );
        try {
          const { body } = await agent
            .post('/api/admin/user/delete')
            .send({
              id: userRegularId,
              username: 'userregular',
              reason: 'reviewed',
            })
            .expect(200);
          should.not.exist(await User.findById(userRegularId));
          should(body.cleanupIncomplete).equal(true);
          sinon.assert.calledOnce(offerCleanup);
          sinon.assert.calledOnce(contactCleanup);
          sinon.assert.calledOnce(messageCleanup);
          sinon.assert.calledOnce(circleCleanup);
          sinon.assert.notCalled(confirmationEmail);
        } finally {
          sinon.restore();
        }
      });
    });
    describe('List users by role', () => {
      it('non-admin users should not be allowed to list users by role', async () => {
        await utils.signIn(credentialsRegular, agent);
        await agent
          .post('/api/admin/users/by-role')
          .send({
            role: 'admin',
          })
          .expect(403);
      });
      it('admin users should be allowed to list users by role and get correct results', async () => {
        await utils.signIn(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/users/by-role')
          .send({
            role: 'admin',
          })
          .expect(200);
        should(body.users.length).equal(1);
        const user = body.users[0];
        should(user.username).equal('useradmin');

        // These should have been removed
        should.not.exist(user.password);
        should.not.exist(user.salt);

        // These should have been obfuscated
        should(user.removeProfileToken).equal('(Hidden from admins.)');
        should(user.resetPasswordToken).equal('(Hidden from admins.)');
      });
      it('listing users by invalid role should not be possible', async () => {
        await utils.signIn(credentialsAdmin, agent);
        await agent
          .post('/api/admin/users/by-role')
          .send({
            role: 'fake',
          })
          .expect(400);
      });
    });
    describe('List users by last IP address', () => {
      it('non-admin users should not be allowed to list users by IP address', async () => {
        await utils.signIn(credentialsRegular, agent);
        await agent
          .post('/api/admin/users/by-last-ip-hash')
          .send({
            ipHash:
              'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          })
          .expect(403);
      });
      it('admin users can list only exact current IP address matches', async () => {
        userRegular.lastIpHash =
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
        await userRegular.save();
        const otherUser = new User({
          displayName: 'Other Name',
          email: 'other@example.com',
          firstName: 'Other',
          lastIpHash:
            'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
          lastName: 'Name',
          password: 'Password123!',
          provider: 'local',
          public: true,
          username: 'userother',
        });
        await otherUser.save();
        await utils.signIn(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/users/by-last-ip-hash')
          .send({
            ipHash:
              'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          })
          .expect(200);
        body.users.should.have.length(1);
        body.users[0].username.should.equal('userregular');
        body.users[0].lastIpHash.should.equal(
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        );
      });
      it('rejects malformed IP addresses', async () => {
        await utils.signIn(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/users/by-last-ip-hash')
          .send({
            ipHash:
              'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, 198.51.100.10',
          })
          .expect(400);
        body.message.should.equal('Invalid IP identifier.');
      });
    });
    describe('Get user by ID', () => {
      it('non-admin users should not be allowed to query', async () => {
        await utils.signIn(credentialsRegular, agent);
        await agent
          .post('/api/admin/user')
          .send({
            id: userRegularId,
          })
          .expect(403);
        await agent
          .post('/api/admin/user')
          .send({
            username: userRegular.username,
          })
          .expect(403);
      });
      it('admin users should be allowed to query and get correct result', async () => {
        // Model an unmigrated record written by the previous application version.
        await User.collection.updateOne(
          { _id: userRegular._id },
          { $set: { lastIpAddress: '203.0.113.30' } },
        );
        await utils.signIn(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/user')
          .send({
            id: userRegularId,
          })
          .expect(200);
        should(body.profile.username).equal('userregular');
        should(body.profile.emailToken).equal('test-token');

        // These should have been removed
        should.not.exist(body.profile.password);
        should.not.exist(body.profile.salt);
        should.not.exist(body.profile.lastIpAddress);

        // These should have been obfuscated
        should(body.profile.removeProfileToken).equal('(Hidden from admins.)');
        should(body.profile.resetPasswordToken).equal('(Hidden from admins.)');
        body.potentialMatches.should.deepEqual([]);
      });
      it('returns 404 for an unknown username', async () => {
        await utils.signIn(credentialsAdmin, agent);
        await agent
          .post('/api/admin/user')
          .send({
            username: 'missing-fictional-member',
          })
          .expect(404);
      });
      it('admin users can resolve an exact username with a matching prefix', async () => {
        const similarUser = new User({
          displayName: 'Similar Member',
          email: 'similar@example.com',
          firstName: 'Similar',
          lastName: 'Member',
          password: 'Password123!',
          provider: 'local',
          public: true,
          username: 'userregularextra',
        });
        await similarUser.save();
        await utils.signIn(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/user')
          .send({
            username: userRegular.username,
          })
          .expect(200);
        body.profile._id.should.equal(userRegularId);
        body.profile.username.should.equal('userregular');
      });
      it('shows bounded identity and acquisition-story leads for restricted members', async () => {
        userRegular.roles = ['user', 'shadowban'];
        userRegular.emailTemporary = 'pending-clue@example.com';
        userRegular.acquisitionStory =
          'A fictional travel club introduced me to Trustroots.';
        await userRegular.save();
        const possibleMatches = [
          new User({
            displayName: 'Username Lead',
            email: 'different@example.test',
            firstName: 'Username',
            lastName: 'Lead',
            password: 'Password123!',
            provider: 'local',
            roles: ['user'],
            username: 'userregularcopy',
          }),
          new User({
            displayName: 'Email Lead',
            email: 'new.regular+account@example.test',
            firstName: 'Email',
            lastName: 'Lead',
            password: 'Password123!',
            provider: 'local',
            roles: ['user'],
            username: 'differentmember',
          }),
          new User({
            displayName: 'Temporary Email Lead',
            email: 'pending.clue+copy@example.test',
            firstName: 'Temporary',
            lastName: 'Lead',
            password: 'Password123!',
            provider: 'local',
            roles: ['user'],
            username: 'anothermember',
          }),
          new User({
            acquisitionStory:
              '  A FICTIONAL TRAVEL CLUB introduced me to Trustroots.  ',
            displayName: 'Story Lead',
            email: 'story@example.test',
            firstName: 'Story',
            lastName: 'Lead',
            password: 'Password123!',
            provider: 'local',
            roles: ['user'],
            username: 'storymember',
          }),
        ];
        await Promise.all(possibleMatches.map(user => user.save()));
        await utils.signIn(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/user')
          .send({
            id: userRegularId,
          })
          .expect(200);
        body.potentialMatches.should.have.length(4);
        const usernameLead = body.potentialMatches.find(
          (user: PotentialAdminUser) => user.username === 'userregularcopy',
        );
        should.exist(usernameLead);
        usernameLead.matchReasons.should.containEql('Username identifier');
        usernameLead.matchReasons.should.containEql('Email identifier');
        const emailLead = body.potentialMatches.find(
          (user: PotentialAdminUser) => user.username === 'differentmember',
        );
        should.exist(emailLead);
        emailLead.matchReasons.should.deepEqual(['Email identifier']);
        const temporaryEmailLead = body.potentialMatches.find(
          (user: PotentialAdminUser) => user.username === 'anothermember',
        );
        should.exist(temporaryEmailLead);
        temporaryEmailLead.matchReasons.should.deepEqual([
          'Temporary email identifier',
        ]);
        const storyLead = body.potentialMatches.find(
          (user: PotentialAdminUser) => user.username === 'storymember',
        );
        should.exist(storyLead);
        storyLead.matchReasons.should.deepEqual(['Acquisition story']);
        storyLead.acquisitionStory.should.match(/fictional travel club/i);
      });
      it('missing id should return no users', async () => {
        await utils.signIn(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/user')
          .send({
            id: '',
          })
          .expect(400);
        should(body.message).equal('Cannot interpret id.');
      });
      it('invalid id should return no users', async () => {
        await utils.signIn(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/user')
          .send({
            id: '123',
          })
          .expect(400);
        should(body.message).equal('Cannot interpret id.');
      });
    });
    describe('Changing user roles', () => {
      it('non-admin users should not be allowed to change user roles', async () => {
        await utils.signIn(credentialsRegular, agent);
        await agent
          .post('/api/admin/user/change-role')
          .send({
            id: userRegularId,
            role: 'suspended',
          })
          .expect(403);
        await agent
          .post('/api/admin/user/change-role')
          .send({
            id: userRegularId,
            role: 'shadowban',
            action: 'remove',
          })
          .expect(403);
      });

      // Allowed roles
      ['shadowban', 'suspended'].map(role => {
        it(`admin users should be allowed change user role to ${role}`, async () => {
          await utils.signIn(credentialsAdmin, agent);
          await agent
            .post('/api/admin/user/change-role')
            .send({
              id: userRegularId,
              role,
            })
            .expect(200);
        });
      });
      it('cannot change user role to legacy moderator', async () => {
        await utils.signIn(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/user/change-role')
          .send({
            id: userRegularId,
            role: 'moderator',
          })
          .expect(400);
        should(body.message).equal('Invalid role.');
      });
      it('admin users can remove a shadowban and see the moderation note', async () => {
        userRegular.roles = ['user', 'shadowban'];
        await userRegular.save();
        await utils.signIn(credentialsAdmin, agent);
        await agent
          .post('/api/admin/user/change-role')
          .send({
            id: userRegularId,
            role: 'shadowban',
            action: 'remove',
          })
          .expect(200);
        const updated = await User.findById(userRegularId).exec();
        if (!updated) throw new Error('Expected updated user');
        if (!updated.roles) throw new Error('Expected updated user roles');
        updated.roles.should.deepEqual(['user']);
        const { body } = await agent
          .get(`/api/admin/notes?userId=${userRegularId}`)
          .expect(200);
        body[0].note.should.equal(
          '<p><b>Performed action:</b></p><p><i>User unshadowbanned.</i></p>',
        );
      });
      it('missing id should not change user role', async () => {
        await utils.signIn(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/user/change-role')
          .send({
            id: '',
            role: 'suspended',
          })
          .expect(400);
        should(body.message).equal('Cannot interpret id.');
      });
      it('invalid role should not be change user roles', async () => {
        await utils.signIn(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/user/change-role')
          .send({
            id: userRegularId,
            role: 'fake',
          })
          .expect(400);
        should(body.message).equal('Invalid role.');
      });
      it('cannot change user role to admin', async () => {
        await utils.signIn(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/user/change-role')
          .send({
            id: userRegularId,
            role: 'admin',
          })
          .expect(400);
        should(body.message).equal('Invalid role.');
      });
      it('invalid id should not change user roles', async () => {
        await utils.signIn(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/user/change-role')
          .send({
            id: '123',
            role: 'suspended',
          })
          .expect(400);
        should(body.message).equal('Cannot interpret id.');
      });
      it(`changing role should show up as an admin note`, async () => {
        await utils.signIn(credentialsAdmin, agent);
        await agent
          .post('/api/admin/user/change-role')
          .send({
            id: userRegularId,
            role: 'suspended',
          })
          .expect(200);
        const { body } = await agent
          .get(`/api/admin/notes?userId=${userRegularId}`)
          .expect(200);
        body[0].note.should.equal(
          '<p><b>Performed action:</b></p><p><i>User suspended.</i></p>',
        );
        body[0].admin._id.should.equal(userAdminId);
      });
    });
  });
});
