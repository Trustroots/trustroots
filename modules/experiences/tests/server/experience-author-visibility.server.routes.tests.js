const mongoose = require('mongoose');
const request = require('supertest');
const should = require('should');
const utils = require('../../../../testutils/server/data.server.testutil');
const express = require('./../../../../config/lib/express.mjs');
const testutils = require('../../../../testutils/server/server.testutil');
const Experience = mongoose.model('Experience');
describe('Experience author moderation visibility', () => {
  before(async function () {
    agent = request.agent(await express.init(mongoose.connection));
  });
  const jobs = testutils.catchJobs();
  let agent;
  let users;
  let credentials;
  let experiences;
  beforeEach(async () => {
    credentials = utils.generateUsersWithSharedPassword(5, {
      public: true,
    });
    users = await utils.saveUsersWithCachedPasswords(credentials);
    experiences = await utils.saveExperiences(
      utils.generateExperiences(users, [
        [2, 1],
        [3, 1],
        [
          4,
          1,
          {
            public: false,
          },
        ],
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
    it(`rejects new experiences addressed to a ${role} member without sending email`, async () => {
      users[1].roles.push(role);
      await users[1].save();
      await agent
        .post('/api/experiences')
        .send({
          userTo: users[1].id,
          interactions: {
            met: true,
          },
          recommend: 'yes',
        })
        .expect(404);
      should(await Experience.countDocuments()).equal(4);
      should(jobs).have.length(0);
    });
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
      should(count.body).eql({
        count: 1,
      });
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
      should(restoredCount.body).eql({
        count: 2,
      });
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
      should(count.body).eql({
        count: 1,
        hasPending: false,
      });
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
  for (const oppositeVisibility of [null, false, true]) {
    it(`keeps a shadowbanned author's submission private and silent with opposite visibility ${oppositeVisibility}`, async () => {
      let opposite;
      if (oppositeVisibility !== null) {
        opposite = await new Experience({
          userFrom: users[1]._id,
          userTo: users[0]._id,
          public: oppositeVisibility,
          interactions: {
            met: true,
          },
          recommend: 'yes',
          feedbackPublic: 'Private reciprocal feedback.',
        }).save();
      }
      users[0].roles.push('shadowban');
      await users[0].save();
      const created = await agent
        .post('/api/experiences')
        .send({
          userTo: users[1].id,
          interactions: {
            met: true,
          },
          recommend: 'no',
          feedbackPublic: 'Hidden author feedback.',
        })
        .expect(201);
      should(created.body.public).be.false();
      should(created.body.response).be.null();
      should(jobs).have.length(0);
      if (opposite) {
        should((await Experience.findById(opposite.id)).public).equal(
          oppositeVisibility,
        );
      }
      await utils.signOut(agent);
      await utils.signIn(credentials[1], agent);
      const received = await agent
        .get(`/api/experiences?userTo=${users[1].id}`)
        .expect(200);
      should(
        received.body.some(experience => experience._id === created.body._id),
      ).be.false();
      await agent.get(`/api/experiences/${created.body._id}`).expect(404);
      const mine = await agent
        .get(`/api/my-experience?userWith=${users[0].id}`)
        .expect(opposite ? 200 : 404);
      if (opposite) should(mine.body.response).be.null();
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
    should(count.body).eql({
      count: 0,
    });
  });
});
