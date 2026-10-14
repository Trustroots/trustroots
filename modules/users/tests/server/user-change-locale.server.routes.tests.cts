import type {
  UserModel,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';

const mongoose: typeof import('mongoose') = require('mongoose');
const request: typeof import('supertest') = require('supertest');
const should: typeof import('should') = require('should');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
const express: typeof import('../../../../config/lib/express.mjs').default = require('../../../../config/lib/express.mjs');
const User = mongoose.model<UserRecord, UserModel>('User');
const publicUsers = utils.generateUsers(1, { public: true });
const nonpublicUsers = utils.generateUsers(1, {
  public: false,
});
nonpublicUsers[0].username = 'nonpublic';
nonpublicUsers[0].email = 'nonpublic@example.com';
const appPromise = express.init(mongoose.connection);
let agent: ReturnType<typeof request.agent>;

before(async function () {
  agent = request.agent(await appPromise);
});
describe('User account: change locale', () => {
  let users: Awaited<ReturnType<typeof utils.saveUsers>>;

  // save users
  beforeEach(async () => {
    users = await utils.saveUsers([...publicUsers, ...nonpublicUsers]);
  });
  afterEach(utils.clearDatabase);
  context('logged in', () => {
    beforeEach(async () => {
      await utils.signIn(publicUsers[0], agent);
    });
    afterEach(async () => {
      await utils.signOut(agent);
    });
    context('valid value', () => {
      it('200 and save the new locale to user model', async () => {
        const { username } = users[0];
        const userBefore = await User.findOne({
          username,
        }).lean();
        should(userBefore).have.property('locale', '');
        const { body } = await agent
          .put('/api/users')
          .send({
            locale: 'cs',
          })
          .expect(200);
        should(body).have.property('locale', 'cs');
        const userAfter = await User.findOne({
          username,
        }).lean();
        should(userAfter).have.property('locale', 'cs');
      });
    });
    context('invalid value', () => {
      it('[number] 400', async () => {
        await agent
          .put('/api/users')
          .send({
            locale: 1111,
          })
          .expect(400);
      });
      it('[invalid string] 400', async () => {
        await agent
          .put('/api/users')
          .send({
            locale: 'invalid string',
          })
          .expect(400);
      });
    });
  });
  context('logged in as nonpublic user', () => {
    beforeEach(async () => {
      await utils.signIn(nonpublicUsers[0], agent);
    });
    afterEach(async () => {
      await utils.signOut(agent);
    });
    it('can update, too', async () => {
      const { username } = nonpublicUsers[0];
      const userBefore = await User.findOne({
        username,
      }).lean();
      should(userBefore).have.property('locale', '');
      await agent
        .put('/api/users')
        .send({
          locale: 'en',
        })
        .expect(200);
      const userAfter = await User.findOne({
        username,
      }).lean();
      should(userAfter).have.property('locale', 'en');
    });
  });
  context('not logged in', () => {
    it('403', async () => {
      await agent
        .put('/api/users')
        .send({
          locale: 'en',
        })
        .expect(403);
    });
  });
});
describe('User account: read locale', () => {
  const publicUsers = utils.generateUsers(2, {
    public: true,
    locale: 'en',
  });

  // save users
  beforeEach(async () => {
    await utils.saveUsers(publicUsers);
  });
  afterEach(utils.clearDatabase);
  context('logged in', () => {
    beforeEach(async () => {
      await utils.signIn(publicUsers[0], agent);
    });
    afterEach(async () => {
      await utils.signOut(agent);
    });
    it('[self] response body of /api/auth/signin should include locale', async () => {
      const { username, password } = publicUsers[0];
      const { body } = await agent
        .post('/api/auth/signin')
        .send({
          username,
          password,
        })
        .expect(200);
      should(body).have.property('locale', 'en');
    });
    it("response body of /api/users/:username shouldn't include locale", async () => {
      const otherUser = publicUsers[1];
      const { body } = await agent
        .get(`/api/users/${otherUser.username}`)
        .expect(200);
      should(body).not.have.property('locale');
    });
  });
});
