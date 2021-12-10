const mongoose = require('mongoose');
const path = require('path');
const request = require('supertest');
const should = require('should');
const config = require(path.resolve('./config/config'));
const express = require(path.resolve('./config/lib/express'));
const testutils = require(path.resolve('./testutils/server/server.testutil'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

/**
 * Support routes tests
 */
describe('Support CRUD tests', () => {
  const app = express.init(mongoose.connection);
  const agent = request.agent(app);

  // We'll catch emails
  const jobs = testutils.catchJobs();

  const _usersPublic = utils.generateUsers(1, { public: true });
  const _usersNonPublic = utils.generateUsers(1, { public: false });
  const _users = [..._usersPublic, ..._usersNonPublic];
  let users;

  const assertSendingSupportMessage = async (supportRequest = {}) => {
    const { body } = await agent
      .post('/api/support')
      .send({
        username: 'demousername',
        email: 'user@example.org',
        message: 'Trustroots rocks!',
        ...supportRequest, // Overrides
      })
      .expect(200);

    body.message.should.equal('Support request sent.');

    const emailJobs = jobs.filter(job => job.type === 'send email');
    const [job] = emailJobs;
    should(emailJobs.length).equal(1);
    should(job.data.to.address).equal(config.supportEmail);
    should(job.data.text).containEql('Trustroots rocks!');

    return job;
  };

  beforeEach(async () => {
    users = await utils.saveUsers(_users);
  });

  afterEach(utils.clearDatabase);

  context('not logged in', () => {
    it('should be able to send support message', async () => {
      const job = await assertSendingSupportMessage();
      should(job.data.subject).equal(`Support request from demousername (-)`);
      should(job.data.text).containEql('Authenticated: no');
      should(job.data.text).containEql('Signup confirmed: no');
    });

    it('should be able to send support message without email and username', async () => {
      const job = await assertSendingSupportMessage({
        username: '',
        email: '',
      });
      should(job.data.subject).equal(`Support request (-)`);
      should(job.data.text).containEql('Authenticated: no');
      should(job.data.text).containEql('Signup confirmed: no');
    });
  });

  context('logged in as public user', () => {
    // Sign in and sign out
    beforeEach(utils.signIn.bind(this, _usersPublic[0], agent));
    afterEach(utils.signOut.bind(this, agent));

    it('should be able to send support message', async () => {
      const job = await assertSendingSupportMessage();
      should(job.data.subject).equal(
        `Support request from ${users[0].username} (${users[0].displayName})`,
      );
      should(job.data.text).containEql('Authenticated: yes');
      should(job.data.text).containEql('Signup confirmed: yes');
    });

    it('should be able to report user in support message', async () => {
      const job = await assertSendingSupportMessage({
        reportMember: 'reported-username',
      });
      should(job.data.text).containEql('reported-username');
    });
  });

  context('logged in as non-public user', () => {
    // Sign in and sign out
    beforeEach(utils.signIn.bind(this, _usersNonPublic[0], agent));
    afterEach(utils.signOut.bind(this, agent));

    it('should be able to send support message', async () => {
      const job = await assertSendingSupportMessage();
      should(job.data.subject).equal(
        `Support request from ${users[1].username} (${users[1].displayName})`,
      );
      should(job.data.text).containEql('Authenticated: yes');
      should(job.data.text).containEql('Signup confirmed: no');
    });
  });
});
