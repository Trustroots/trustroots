import type { ServerUserFixture } from '../../../../testutils/common/data.common.testutil.mts';

const request: typeof import('supertest') = require('supertest');
const mongoose: typeof import('mongoose') = require('mongoose');
const config: typeof import('../../../../config/config.mts').default = require('./../../../../config/config.mts');
const express: {
  init(
    connection: import('mongoose').Connection,
  ): Promise<import('express').Express>;
} = require('./../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
require('should');
describe('User Avatar CRUD tests', () => {
  // Get application
  let app: import('express').Express;
  let agent: ReturnType<typeof request.agent>;

  before(async function () {
    app = await express.init(mongoose.connection);
    agent = request.agent(app);
  });
  type AvatarFixture = ServerUserFixture & {
    avatarSource?: string;
    avatarUploaded?: boolean;
    additionalProvidersData?: {
      facebook?: { id?: string };
    };
  };
  const _users: AvatarFixture[] = utils.generateUsers(6);

  // "Gravatar" avatar user
  // By default users get assigned 'gravatar' as source
  _users[0].public = true;
  _users[0].avatarSource = 'gravatar';
  _users[0].avatarUploaded = true; // Used to source switching test

  // "None" avatar user
  _users[1].public = true;
  _users[1].avatarSource = 'none';

  // Local avatar user
  _users[2].public = true;
  _users[2].avatarSource = 'local';
  _users[2].avatarUploaded = true;

  // Member with a legacy Facebook avatar selection stored before retirement
  _users[3].public = true;
  _users[3].avatarSource = 'none';
  _users[3].additionalProvidersData = {
    facebook: {
      id: '12345678912345678',
    },
  };

  // Non public user
  _users[4].public = false;

  // Shadowbanned user
  _users[5].public = true;
  _users[5].roles = ['shadowban'];
  const credentials = {
    username: _users[0].username,
    password: _users[0].password,
  };
  const defaultRedirect = `Found. Redirecting to http://${config.domain}/img/avatar-1024.png`;
  type ResponseWithRawText = import('supertest').Response & {
    res: { text: string };
  };
  let gravatarUser: import('mongoose').Types.ObjectId | string;
  let gravatarHash: string | undefined;
  let noneUser: import('mongoose').Types.ObjectId | string;
  let localUser: import('mongoose').Types.ObjectId | string;
  let facebookUser: import('mongoose').Types.ObjectId | string;
  let nonPublicUser: import('mongoose').Types.ObjectId | string;
  let shadowbannedUser: import('mongoose').Types.ObjectId | string;
  beforeEach(async () => {
    const users = await utils.saveUsers(_users);
    gravatarUser = users[0]._id;
    gravatarHash = users[0].emailHash;
    noneUser = users[1]._id;
    localUser = users[2]._id;
    facebookUser = users[3]._id;
    await mongoose
      .model('User')
      .collection.updateOne(
        { _id: facebookUser },
        { $set: { avatarSource: 'facebook' } },
      );
    nonPublicUser = users[4]._id;
    shadowbannedUser = users[5]._id;
  });
  afterEach(utils.clearDatabase);
  describe('See user avatar', () => {
    it('non-authenticated users should not be allowed to see user avatars', async () =>
      await agent.get(`/api/users/${gravatarUser}/avatar`).expect(403));
    describe('As authenticated user...', () => {
      beforeEach(async () => {
        await utils.signIn(credentials, agent);
      });
      afterEach(async () => {
        await utils.signOut(agent);
      });
      it('Should not return images for invalid looking routes', async () =>
        await agent.get(`/api/users/123/avatar`).expect(400));
      it('Get default image for non-existing users', async () => {
        const { res } = (await agent
          .get(`/api/users/5eefc92b4f63d31861f91f57/avatar`)
          .expect(302)) as ResponseWithRawText;
        res.text.should.equal(defaultRedirect);
      });
      it('Get 404 response for non public users', async () => {
        await agent.get(`/api/users/${nonPublicUser}/avatar`).expect(404);

        // @TODO: we should just reurn default image instead of 404
        // res.text.should.equal(defaultRedirect);
      });
      it('Get default image for shadow banned users', async () => {
        const { res } = (await agent
          .get(`/api/users/${shadowbannedUser}/avatar`)
          .expect(302)) as ResponseWithRawText;
        res.text.should.equal(defaultRedirect);
      });
      it('Get default image when no profile picture', async () => {
        const { res } = (await agent
          .get(`/api/users/${noneUser}/avatar`)
          .expect(302)) as ResponseWithRawText;
        res.text.should.equal(defaultRedirect);
      });
      it('Authenticated user can receive their own avatar from different source', async () => {
        const { res } = (await agent
          .get(`/api/users/${gravatarUser}/avatar?source=local`)
          .expect(302)) as ResponseWithRawText;
        res.text.should.equal(
          `Found. Redirecting to http://${config.domain}/uploads-profile/${gravatarUser}/avatar/1024.jpg?`,
        );
      });
      it('Authenticated user canot receive other avatars from different source', async () => {
        const { res } = (await agent
          .get(`/api/users/${localUser}/avatar?source=gravatar`)
          .expect(302)) as ResponseWithRawText;
        res.text.should.equal(
          `Found. Redirecting to http://${config.domain}/uploads-profile/${localUser}/avatar/1024.jpg?`,
        );
      });
      it('Get Gravatar image', async () => {
        const { res } = (await agent
          .get(`/api/users/${gravatarUser}/avatar`)
          .expect(302)) as ResponseWithRawText;
        res.text.should.equal(
          `Found. Redirecting to https://gravatar.com/avatar/${gravatarHash}?s=1024&d=https%3A%2F%2Ftrustroots.org%2Fimg%2Favatar-1024.png`,
        );
      });
      it('Can get local image', async () => {
        const { res } = (await agent
          .get(`/api/users/${localUser}/avatar`)
          .expect(302)) as ResponseWithRawText;
        res.text.should.equal(
          `Found. Redirecting to http://${config.domain}/uploads-profile/${localUser}/avatar/1024.jpg?`,
        );
      });
      it('uses the default image for a legacy Facebook avatar', async () => {
        const { res } = (await agent
          .get(`/api/users/${facebookUser}/avatar`)
          .expect(302)) as ResponseWithRawText;
        res.text.should.equal(defaultRedirect);
      });

      it('rejects Facebook as an explicit avatar source', async () => {
        await agent
          .get(`/api/users/${gravatarUser}/avatar?source=facebook`)
          .expect(400);
      });
    });
  });
});
