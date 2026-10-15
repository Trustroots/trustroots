const mongoose: typeof import('mongoose') = require('mongoose');
const request: typeof import('supertest') = require('supertest');
const express: typeof import('../../../../config/lib/express.mjs').default = require('./../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
require('should');

type Credentials = { username: string; password: string };
type AcquisitionStoryRow = {
  _id: string;
  username: string;
  acquisitionStory?: string;
  restrictionStatuses: string[];
};
describe('Admin acquisition stories CRUD tests', () => {
  let app: import('express').Express;
  let agent: ReturnType<typeof request.agent>;
  before(async function () {
    app = await express.init(mongoose.connection);
    agent = request.agent(app);
  });
  // Get application

  const acquisitionStories = [
    'A fictional friend.',
    'A fictional gathering.',
    'A fictional recommendation.',
  ];
  let credentialsAdmin: Credentials;
  let credentialsRegular: Credentials;
  beforeEach(async () => {
    const users = utils
      .generateUsersWithSharedPassword(acquisitionStories.length)
      .map((user, index) =>
        Object.assign(user, { acquisitionStory: acquisitionStories[index] }),
      );
    users[0].roles = ['user', 'admin'];
    users[2].roles = ['user', 'shadowban', 'suspended', 'volunteer'];
    const savedUsers = await utils.saveUsersWithCachedPasswords(users);
    credentialsAdmin = {
      username: savedUsers[0].username,
      password: users[0].password,
    };
    credentialsRegular = {
      username: savedUsers[1].username,
      password: users[1].password,
    };
  });
  afterEach(utils.clearDatabase);
  describe('Acquisition stories', () => {
    it('non-authenticated users should not be allowed to read acquisition stories', async () => {
      await agent
        .post('/api/admin/acquisition-stories')
        .set('X-Trustroots-Request', '1')
        .expect(403);
    });
    describe('As authenticated user...', () => {
      afterEach(async () => {
        await utils.signOut(agent);
      });
      it('non-admin users should not be allowed to read acquisition stories', async () => {
        await utils.signIn(credentialsRegular, agent);
        await agent
          .post('/api/admin/acquisition-stories')
          .set('X-Trustroots-Request', '1')
          .expect(403);
      });
      it('greeters can read restriction statuses but cannot change roles', async () => {
        await mongoose
          .model('User')
          .updateOne(
            { username: credentialsRegular.username },
            { $set: { roles: ['user', 'welcome-team'] } },
          );
        await utils.signInPrivileged(credentialsRegular, agent);
        const { body }: { body: AcquisitionStoryRow[] } = await agent
          .post('/api/admin/acquisition-stories')
          .set('X-Trustroots-Request', '1')
          .expect(200);
        const target = body.find(
          row => row.acquisitionStory === acquisitionStories[2],
        );
        target!.restrictionStatuses.should.deepEqual([
          'suspended',
          'shadowban',
        ]);
        body
          .find(row => row.username === credentialsRegular.username)!
          .restrictionStatuses.should.deepEqual([]);
        await agent
          .post('/api/admin/user/change-role')
          .set('X-Trustroots-Request', '1')
          .send({ id: target!._id, role: 'shadowban', action: 'remove' })
          .expect(403);
      });
      it('admin users should be allowed to read acquisition stories', async () => {
        await utils.signInPrivileged(credentialsAdmin, agent);
        const { body }: { body: AcquisitionStoryRow[] } = await agent
          .post('/api/admin/acquisition-stories')
          .set('X-Trustroots-Request', '1')
          .expect(200);
        body.length.should.equal(acquisitionStories.length);
        body
          .find(row => row.acquisitionStory === acquisitionStories[2])!
          .restrictionStatuses.should.deepEqual(['suspended', 'shadowban']);
        body.every(row => !Object.hasOwn(row, 'roles')).should.equal(true);
      });
    });
  });
  it('returns 404 for the retired analysis API', async () => {
    await agent
      .post('/api/admin/acquisition-stories/analysis')
      .set('X-Trustroots-Request', '1')
      .expect(404);
  });
});
