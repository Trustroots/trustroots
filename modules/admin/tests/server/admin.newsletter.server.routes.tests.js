const request = require('supertest');
const mongoose = require('mongoose');

const express = require('../../../../config/lib/express');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

describe('Admin Newsletter subscribers split API tests', () => {
  // Get application
  const app = express.init(mongoose.connection);
  const agent = request.agent(app);

  const _users = utils.generateUsers(4, { newsletter: false, public: true });
  _users[0].roles = ['user', 'admin'];
  _users[2].email = 'active@example.com';
  _users[2].firstName = 'Active';
  _users[2].lastName = 'Subscriber';
  _users[2].newsletter = true;

  _users[3].email = 'inactive@example.com';
  _users[3].firstName = 'Inactive';
  _users[3].lastName = 'Subscriber';
  _users[3].newsletter = false;

  const adminAuth = {
    username: _users[0].username,
    password: _users[0].password,
  };

  const nonAdminAuth = {
    username: _users[1].username,
    password: _users[1].password,
  };

  before(async () => {
    await utils.saveUsers(_users);
  });

  after(utils.clearDatabase);

  it('non-authenticated users should not be allowed to split subscribers', async () => {
    await agent.post('/api/admin/newsletter-subscribers/split').expect(403);
  });

  it('non-admin users should not be allowed to split subscribers', async () => {
    await utils.signIn(nonAdminAuth, agent);
    await agent.post('/api/admin/newsletter-subscribers/split').expect(403);
    await utils.signOut(agent);
  });

  it('admin users can split uploaded subscribers into two CSV exports', async () => {
    await utils.signIn(adminAuth, agent);

    const { body } = await agent
      .post('/api/admin/newsletter-subscribers/split')
      .attach(
        'newsletterCsv',
        Buffer.from(
          [
            'Email Address',
            'active@example.com',
            'inactive@example.com',
            'missing@example.com',
          ].join('\n'),
        ),
        'newsletter.csv',
      )
      .expect(200);

    body.totalEmailCount.should.equal(3);
    body.subscribedCount.should.equal(1);
    body.unsubscribedCount.should.equal(2);
    body.subscribedCsv.should.equal(
      'Email Address,First Name,Last Name\nactive@example.com,Active,Subscriber',
    );
    body.unsubscribedCsv.should.equal(
      [
        'Email Address,First Name,Last Name',
        'inactive@example.com,Inactive,Subscriber',
        'missing@example.com,,',
      ].join('\n'),
    );

    await utils.signOut(agent);
  });

  it('admin users receive validation errors for missing CSV uploads', async () => {
    await utils.signIn(adminAuth, agent);

    await agent.post('/api/admin/newsletter-subscribers/split').expect(422);

    await utils.signOut(agent);
  });

  it('admin users receive unsupported media errors for non-csv files', async () => {
    await utils.signIn(adminAuth, agent);

    const response = await agent
      .post('/api/admin/newsletter-subscribers/split')
      .attach('newsletterCsv', Buffer.from('{}'), {
        contentType: 'application/json',
        filename: 'newsletter.json',
      })
      .expect(415);

    response.body.message.should.equal(
      'Please upload a file that is in correct format.',
    );

    await utils.signOut(agent);
  });
});
