import type {
  ExperienceModel,
  ExperienceRecord,
  TestAgent,
  TestExpressModule,
  UserDocument,
} from '../../../../testutils/server/model-contracts.mts';
const mongoose: typeof import('mongoose') = require('mongoose');
const request: typeof import('supertest') = require('supertest');
const utils: typeof import('../../../../testutils/server/data.server.testutil') = require('../../../../testutils/server/data.server.testutil');
const express: TestExpressModule = require('../../../../config/lib/express.mjs');
require('should');
const Experience = mongoose.model<ExperienceRecord, ExperienceModel>(
  'Experience',
);

describe('Experience reply recipient access', () => {
  let agent: TestAgent;
  let users: UserDocument[];
  const userData = utils.generateUsersWithSharedPassword(3, { public: true });
  before(async () => {
    agent = request.agent(await express.init(mongoose.connection));
  });
  beforeEach(async () => {
    users = await utils.saveUsersWithCachedPasswords(userData);
    users[0].blocked = [users[1]._id];
    await users[0].save();
    await Experience.create({
      userFrom: users[0]._id,
      userTo: users[1]._id,
      public: false,
      recommend: 'no',
      interactions: { met: true },
    });
    await utils.signIn(userData[1], agent);
  });
  afterEach(async () => {
    await utils.signOut(agent);
    await utils.clearDatabase();
  });
  const path = () => `/api/experiences/reply-recipient/${users[0].username}`;

  it('allows the blocked recipient to reply while the author profile stays hidden', async () => {
    await agent.get(`/api/users/${users[0].username}`).expect(404);
    const { body } = await agent.get(path()).expect(200);
    body.should.deepEqual({
      _id: users[0]._id.toString(),
      username: users[0].username,
      displayName: users[0].displayName,
    });
    await agent
      .post('/api/experiences')
      .send({
        userTo: body._id,
        recommend: 'no',
        interactions: { met: true },
        feedbackPublic: 'A different account of our meeting.',
      })
      .expect(201);
    await agent
      .post('/api/experiences')
      .send({
        userTo: body._id,
        recommend: 'no',
        interactions: { met: true },
      })
      .expect(409);
    await agent.get(`/api/users/${users[0].username}`).expect(404);
    await utils.signOut(agent);
    await utils.signIn(userData[0], agent);
    const pair = await agent
      .get('/api/my-experience')
      .query({ userWith: users[1]._id.toString() })
      .expect(200);
    pair.body.response.feedbackPublic.should.equal(
      'A different account of our meeting.',
    );
    users[0].blocked!.map(String).should.containEql(users[1]._id.toString());
  });

  it('also allows a reply when both participants have blocked each other', async () => {
    users[1].blocked = [users[0]._id];
    await users[1].save();
    await agent.get(path()).expect(200);
  });

  it('does not grant access to an unrelated member', async () => {
    await utils.signOut(agent);
    await utils.signIn(userData[2], agent);
    await agent.get(path()).expect(404);
  });

  it('does not grant access based on a removed Experience', async () => {
    await Experience.updateMany({}, { $set: { removedAt: new Date() } });
    await agent.get(path()).expect(404);
  });

  for (const state of ['private', 'suspended', 'shadowban']) {
    it(`does not reveal a ${state} author`, async () => {
      if (state === 'private') users[0].public = false;
      else users[0].roles = ['user', state];
      await users[0].save();
      await agent.get(path()).expect(404);
    });
  }

  it('does not reveal an absent author', async () => {
    await agent
      .get('/api/experiences/reply-recipient/missing-member')
      .expect(404);
  });

  it('requires an authenticated, public viewer', async () => {
    await utils.signOut(agent);
    await agent.get(path()).expect(403);
    users[1].public = false;
    await users[1].save();
    await utils.signIn(userData[1], agent);
    await agent.get(path()).expect(403);
  });
});
