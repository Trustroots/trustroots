const request = require('supertest');
const path = require('path');
const mongoose = require('mongoose');

const express = require(path.resolve('./config/lib/express'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

describe('Admin Newsletter subscribers CRUD tests', () => {
  // Get application
  const app = express.init(mongoose.connection);
  const agent = request.agent(app);

  // One public user without newsletter subscription
  // One private user with newsletter subscription
  // Two public users with newsletter subscription
  // => API result should have two users listed
  const _users = utils.generateUsers(4, { newsletter: true, public: true });
  _users[0].roles = ['user', 'admin'];
  _users[0].newsletter = false;
  _users[1].public = false;

  // Test for non-alloed characters; they should get stripped out
  _users[2].firstName = "First o'name";
  _users[2].lastName = 'Last," name ';
  _users[3].firstName = 'First name';
  _users[3].lastName = 'Last name ';

  const adminAuth = {
    username: _users[0].username,
    password: _users[0].password,
  };

  const nonAdminAuth = {
    username: _users[1].username,
    password: _users[1].password,
  };

  let users;

  before(async () => {
    users = await utils.saveUsers(_users);
  });

  after(utils.clearDatabase);

  it('non-authenticated users should not be allowed to read newsletter subscribers', async () => {
    await agent.get('/api/admin/newsletter-subscribers').expect(403);
  });

  it('non-admin users should not be allowed to read newsletter subscribers', async () => {
    await utils.signIn(nonAdminAuth, agent);
    await agent.get('/api/admin/newsletter-subscribers').expect(403);
    await utils.signOut(agent);
  });

  it('admin users should be allowed to read newsletter subscribers', async () => {
    await utils.signIn(adminAuth, agent);

    const { type, text } = await agent
      .get('/api/admin/newsletter-subscribers')
      .expect(200);

    type.should.equal('text/csv');

    const lines = text.split('\n');
    lines.length.should.equal(3);
    lines[0].should.equal('Email Address,First Name,Last Name');
    lines[1].should.equal(`${users[2].email},First oname,Last name`);
    lines[2].should.equal(`${users[3].email},First name,Last name`);

    await utils.signOut(agent);
  });
});
