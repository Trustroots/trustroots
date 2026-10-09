const mongoose = require('mongoose');
const request = require('supertest');
const should = require('should');
const utils = require('../../../../testutils/server/data.server.testutil');
const express = require('./../../../../config/lib/express.mjs');
const Contact = mongoose.model('Contact');
describe('Direct contact moderation visibility', () => {
  let agent;
  before(async function () {
    agent = request.agent(await express.init(mongoose.connection));
  });
  let users;
  let credentials;
  beforeEach(async () => {
    credentials = utils.generateUsersWithSharedPassword(2, {
      public: true,
    });
    users = await utils.saveUsersWithCachedPasswords(credentials);
    await utils.signIn(credentials[0], agent);
  });
  afterEach(async () => {
    await utils.signOut(agent);
    await utils.clearDatabase();
  });
  for (const role of ['suspended', 'shadowban']) {
    for (const restrictedIsSender of [true, false]) {
      it(`hides direct contacts with a ${role} ${
        restrictedIsSender ? 'sender' : 'recipient'
      } and prevents confirmation`, async () => {
        const contact = await new Contact({
          userFrom: users[restrictedIsSender ? 1 : 0]._id,
          userTo: users[restrictedIsSender ? 0 : 1]._id,
          confirmed: false,
        }).save();
        users[1].roles.push(role);
        await users[1].save();
        await agent.get(`/api/contact-by/${users[1].id}`).expect(404);
        await agent.get(`/api/contact/${contact.id}`).expect(404);
        await agent
          .put(`/api/contact/${contact.id}`)
          .set('Content-Type', 'application/json')
          .send({})
          .expect(404);
        should((await Contact.findById(contact.id)).confirmed).be.false();
        users[1].roles = ['user'];
        await users[1].save();
        await agent.get(`/api/contact-by/${users[1].id}`).expect(200);
        await agent.get(`/api/contact/${contact.id}`).expect(200);
        if (restrictedIsSender) {
          await agent
            .put(`/api/contact/${contact.id}`)
            .set('Content-Type', 'application/json')
            .send({})
            .expect(200);
          should((await Contact.findById(contact.id)).confirmed).be.true();
        }
      });
    }
  }
});
