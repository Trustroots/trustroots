const mongoose = require('mongoose');
const request = require('supertest');
const should = require('should');
const utils = require('../../../../testutils/server/data.server.testutil');
const express = require('../../../../config/lib/express');

const Experience = mongoose.model('Experience');

describe('Experience author moderation visibility', () => {
  const agent = request.agent(express.init(mongoose.connection));
  let users;
  let credentials;
  let experiences;

  beforeEach(async () => {
    credentials = utils.generateUsers(5, { public: true });
    users = await utils.saveUsers(credentials);
    experiences = await utils.saveExperiences(
      utils.generateExperiences(users, [
        [2, 1],
        [3, 1],
        [4, 1, { public: false }],
        [1, 2],
      ]),
    );
    await utils.signIn(credentials[0], agent);
  });

  afterEach(async () => {
    await utils.signOut(agent);
    await utils.clearDatabase();
  });

  for (const role of ['suspended', 'shadowban']) {
    it(`hides ${role} authors from another member's profile and count, then restores them when unbanned`, async () => {
      for (const index of [2, 4]) {
        users[index].roles.push(role);
        await users[index].save();
      }

      const list = await agent
        .get(`/api/experiences?userTo=${users[1].id}`)
        .expect(200);
      should(list.body.map(experience => experience.userFrom._id)).eql([
        users[3].id,
      ]);
      const count = await agent
        .get(`/api/experiences/count?userTo=${users[1].id}`)
        .expect(200);
      should(count.body).eql({ count: 1 });
      await agent.get(`/api/experiences/${experiences[0].id}`).expect(404);

      users[2].roles = ['user'];
      await users[2].save();
      const restoredList = await agent
        .get(`/api/experiences?userTo=${users[1].id}`)
        .expect(200);
      should(restoredList.body).have.length(2);
      const restoredCount = await agent
        .get(`/api/experiences/count?userTo=${users[1].id}`)
        .expect(200);
      should(restoredCount.body).eql({ count: 2 });
      await agent.get(`/api/experiences/${experiences[0].id}`).expect(200);
      should(await Experience.countDocuments()).equal(4);
    });

    it(`hides ${role} authors from the recipient's own profile, pending indicator and paired responses`, async () => {
      for (const index of [2, 4]) {
        users[index].roles.push(role);
        await users[index].save();
      }
      await utils.signOut(agent);
      await utils.signIn(credentials[1], agent);

      const list = await agent
        .get(`/api/experiences?userTo=${users[1].id}`)
        .expect(200);
      should(list.body.map(experience => experience.userFrom._id)).eql([
        users[3].id,
      ]);
      const count = await agent
        .get(`/api/experiences/count?userTo=${users[1].id}`)
        .expect(200);
      should(count.body).eql({ count: 1, hasPending: false });
      await agent.get(`/api/experiences/${experiences[2].id}`).expect(404);

      const detail = await agent
        .get(`/api/experiences/${experiences[3].id}`)
        .expect(200);
      should(detail.body.response).be.null();
      const mine = await agent
        .get(`/api/my-experience?userWith=${users[2].id}`)
        .expect(200);
      should(mine.body._id).equal(experiences[3].id);
      should(mine.body.response).be.null();
      await agent.get(`/api/my-experience?userWith=${users[4].id}`).expect(404);
    });
  }

  it('returns an empty list and zero count when all authors are hidden', async () => {
    users[2].roles.push('suspended');
    users[3].roles.push('shadowban');
    await users[2].save();
    await users[3].save();
    const list = await agent
      .get(`/api/experiences?userTo=${users[1].id}`)
      .expect(200);
    should(list.body).eql([]);
    const count = await agent
      .get(`/api/experiences/count?userTo=${users[1].id}`)
      .expect(200);
    should(count.body).eql({ count: 0 });
  });
});
