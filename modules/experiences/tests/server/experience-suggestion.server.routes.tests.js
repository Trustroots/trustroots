const mongoose = require('mongoose');
const request = require('supertest');
const should = require('should');
const utils = require('../../../../testutils/server/data.server.testutil');
const express = require('../../../../config/lib/express');

require('../../../contacts/server/models/contacts.server.model');
require('../../server/models/experiences.server.model');
const Contact = mongoose.model('Contact');
const Experience = mongoose.model('Experience');

describe('Experience suggestion', () => {
  const app = express.init(mongoose.connection);
  const agent = request.agent(app);
  const userData = utils.generateUsers(8, { public: true });
  let users;

  beforeEach(async () => {
    users = await utils.saveUsers(userData);

    users[4].public = false;
    users[5].roles = ['user', 'shadowban'];
    users[7].roles = ['user', 'suspended'];
    users[0].blocked = [users[6]._id];
    users[6].blocked = [users[0]._id];
    await Promise.all([
      users[4].save(),
      users[5].save(),
      users[0].save(),
      users[6].save(),
      users[7].save(),
    ]);

    await Contact.create([
      { userFrom: users[0]._id, userTo: users[1]._id, confirmed: true },
      { userFrom: users[2]._id, userTo: users[0]._id, confirmed: true },
      { userFrom: users[0]._id, userTo: users[3]._id, confirmed: false },
      { userFrom: users[0]._id, userTo: users[4]._id, confirmed: true },
      { userFrom: users[0]._id, userTo: users[5]._id, confirmed: true },
      { userFrom: users[0]._id, userTo: users[6]._id, confirmed: true },
      { userFrom: users[0]._id, userTo: users[7]._id, confirmed: true },
    ]);

    await Experience.create([
      {
        userFrom: users[0]._id,
        userTo: users[1]._id,
        public: true,
        recommend: 'yes',
        interactions: { met: true },
      },
      {
        userFrom: users[2]._id,
        userTo: users[0]._id,
        public: false,
        recommend: 'unknown',
        interactions: { met: true },
      },
    ]);
  });

  afterEach(async () => {
    await utils.signOut(agent).catch(() => {});
    await utils.clearDatabase();
  });

  it('returns only minimal public identity for an eligible confirmed contact', async () => {
    await utils.signIn(userData[0], agent);

    const { body } = await agent.get('/api/experiences/suggestion').expect(200);

    body.should.deepEqual({
      _id: users[2]._id.toString(),
      displayName: users[2].displayName,
      username: users[2].username,
    });
  });

  it('returns no suggestion after the member writes the matching experience', async () => {
    await new Experience({
      userFrom: users[0]._id,
      userTo: users[2]._id,
      public: true,
      recommend: 'yes',
      interactions: { met: true },
    }).save();
    await utils.signIn(userData[0], agent);

    const { body } = await agent.get('/api/experiences/suggestion').expect(200);

    should(body).equal(null);
  });

  it('rejects anonymous visitors', async () => {
    await request(app).get('/api/experiences/suggestion').expect(403);
  });

  it('rejects non-public members', async () => {
    await utils.signIn(userData[4], agent);
    await agent.get('/api/experiences/suggestion').expect(403);
  });
});
