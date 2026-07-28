const request = require('supertest');
const mongoose = require('mongoose');

const express = require('../../../../config/lib/express');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

describe('Admin Newsletter subscribers API tests', () => {
  // Get application
  const app = express.init(mongoose.connection);
  const agent = request.agent(app);
  const circleId = new mongoose.Types.ObjectId('5fbab4f7fed63c7ed73276d3');
  const circleMembership = [{ tribe: circleId, since: new Date() }];

  const _users = utils.generateUsers(6, { newsletter: false, public: true });
  _users[0].roles = ['user', 'admin'];

  _users[2].email = 'active@example.com';
  _users[2].firstName = 'Active';
  _users[2].lastName = 'Subscriber';
  _users[2].newsletter = true;
  _users[2].member = circleMembership;

  _users[3].email = 'inactive@example.com';
  _users[3].firstName = 'Inactive';
  _users[3].lastName = 'Subscriber';
  _users[3].newsletter = false;
  _users[3].member = circleMembership;

  _users[4].email = 'suspended@example.com';
  _users[4].firstName = 'Suspended';
  _users[4].lastName = 'Subscriber';
  _users[4].newsletter = true;
  _users[4].roles = ['user', 'suspended'];
  _users[4].member = circleMembership;

  _users[5].email = 'pending-delete@example.com';
  _users[5].firstName = 'Pending';
  _users[5].lastName = 'Deletion';
  _users[5].newsletter = true;
  _users[5].removeProfileToken = 'remove-token';
  _users[5].removeProfileExpires = Date.now() + 3600 * 1000;
  _users[5].member = circleMembership;

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

  it('non-authenticated users should not be allowed to export subscribers', async () => {
    await agent.get('/api/admin/newsletter-subscribers').expect(403);
    await agent
      .get(`/api/admin/newsletter-subscribers/circle?circleId=${circleId}`)
      .expect(403);
  });

  it('non-admin users should not be allowed to split subscribers', async () => {
    await utils.signIn(nonAdminAuth, agent);
    await agent.post('/api/admin/newsletter-subscribers/split').expect(403);
    await agent.get('/api/admin/newsletter-subscribers').expect(403);
    await agent
      .get(`/api/admin/newsletter-subscribers/circle?circleId=${circleId}`)
      .expect(403);
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
            'suspended@example.com',
            'pending-delete@example.com',
            'missing@example.com',
          ].join('\n'),
        ),
        'newsletter.csv',
      )
      .expect(200);

    body.totalEmailCount.should.equal(5);
    body.subscribedCount.should.equal(1);
    body.unsubscribedCount.should.equal(4);
    body.subscribedCsv.should.equal(
      'Email Address,First Name,Last Name\nactive@example.com,Active,Subscriber',
    );
    body.unsubscribedCsv.should.equal(
      [
        'Email Address,First Name,Last Name',
        'inactive@example.com,Inactive,Subscriber',
        'suspended@example.com,Suspended,Subscriber',
        'pending-delete@example.com,Pending,Deletion',
        'missing@example.com,,',
      ].join('\n'),
    );

    await utils.signOut(agent);
  });

  it('admin users can export all eligible newsletter subscribers', async () => {
    await utils.signIn(adminAuth, agent);

    const { type, text } = await agent
      .get('/api/admin/newsletter-subscribers')
      .expect(200);

    type.should.equal('text/csv');
    text.should.equal(
      'Email Address,First Name,Last Name\nactive@example.com,Active,Subscriber',
    );

    await utils.signOut(agent);
  });

  it('admin users can export eligible newsletter subscribers for a circle', async () => {
    await utils.signIn(adminAuth, agent);

    const { type, text } = await agent
      .get(`/api/admin/newsletter-subscribers/circle?circleId=${circleId}`)
      .expect(200);

    type.should.equal('text/csv');
    text.should.equal(
      'Email Address,First Name,Last Name\nactive@example.com,Active,Subscriber',
    );

    await utils.signOut(agent);
  });

  it('admin users get a validation error when exporting circle subscribers without circleId', async () => {
    await utils.signIn(adminAuth, agent);

    const response = await agent
      .get('/api/admin/newsletter-subscribers/circle')
      .expect(400);

    response.body.message.should.equal('Please fill in a valid ID.');

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
