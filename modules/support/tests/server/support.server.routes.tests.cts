import type { Application } from 'express';
import type { UserDocument } from '../../../../testutils/server/model-contracts.mts';
import type { CapturedJob } from '../../../../testutils/server/server.testutil.mts';

const mongoose: typeof import('mongoose') = require('mongoose');
const request: typeof import('supertest') = require('supertest');
const should = require('should');
const config: typeof import('../../../../config/config.mts').default = require('./../../../../config/config.mts');
const express: typeof import('../../../../config/lib/express.mjs').default = require('./../../../../config/lib/express.mjs');
const testutils: typeof import('../../../../testutils/server/server.testutil.mts') = require('../../../../testutils/server/server.testutil');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');

interface EmailJob extends CapturedJob {
  type: 'send email';
  data: {
    to: { address: string };
    subject: string;
    text: string;
  };
}

function isEmailJob(job: CapturedJob): job is EmailJob {
  if (job.type !== 'send email' || typeof job.data !== 'object' || !job.data) {
    return false;
  }
  const data = job.data as Partial<EmailJob['data']>;
  return (
    typeof data.to?.address === 'string' &&
    typeof data.subject === 'string' &&
    typeof data.text === 'string'
  );
}

/**
 * Support routes tests
 */
describe('Support CRUD tests', () => {
  let app: Application;
  let agent: ReturnType<typeof request.agent>;

  before(async function () {
    app = await express.init(mongoose.connection);
    agent = request.agent(app);
  });

  // We'll catch emails
  const jobs = testutils.catchJobs();
  const _usersPublic = utils.generateUsers(1, {
    public: true,
  });
  const _usersNonPublic = utils.generateUsers(1, {
    public: false,
  });
  const _users = [..._usersPublic, ..._usersNonPublic];
  let users: UserDocument[];
  const assertSendingSupportMessage = async (
    supportRequest: Record<string, unknown> = {},
  ): Promise<EmailJob> => {
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
    const emailJobs = jobs.filter(isEmailJob);
    const [job] = emailJobs;
    if (!job) throw new Error('Expected a captured support message email job');
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
    it('stores and emails a volunteer enquiry', async () => {
      const job = await assertSendingSupportMessage({
        category: 'volunteering',
      });
      should(job.data.subject).containEql('[Volunteering]');
      should(job.data.text).containEql('Category: Volunteering');
      const stored = await mongoose.model('SupportRequest').findOne({
        username: 'demousername',
      });
      stored.category.should.equal('volunteering');
    });
    it('rejects an invalid category without storing or emailing it', async () => {
      await agent
        .post('/api/support')
        .send({
          category: 'unknown',
          message: 'Please help.',
        })
        .expect(400);
      (await mongoose.model('SupportRequest').countDocuments()).should.equal(0);
      jobs.filter(isEmailJob).length.should.equal(0);
    });
    it('should be able to send support message', async () => {
      const job = await assertSendingSupportMessage();
      should(job.data.subject).equal(
        `Support request [Other] from demousername (-)`,
      );
      should(job.data.text).containEql('Authenticated: no');
      should(job.data.text).containEql('Signup confirmed: no');
    });
    it('should be able to send support message without email and username', async () => {
      const job = await assertSendingSupportMessage({
        username: '',
        email: '',
      });
      should(job.data.subject).equal(`Support request [Other] (-)`);
      should(job.data.text).containEql('Authenticated: no');
      should(job.data.text).containEql('Signup confirmed: no');
    });
  });
  context('logged in as public user', () => {
    // Sign in and sign out
    beforeEach(function () {
      return utils.signIn.call(this, _usersPublic[0], agent);
    });
    afterEach(function () {
      return utils.signOut.call(this, agent);
    });
    it('stores and emails a signed-in volunteer enquiry using member details', async () => {
      const job = await assertSendingSupportMessage({
        category: 'volunteering',
      });
      should(job.data.subject).containEql('[Volunteering]');
      should(job.data.text).containEql('Category: Volunteering');
      const stored = await mongoose.model('SupportRequest').findOne({
        user: users[0]._id,
      });
      stored.category.should.equal('volunteering');
      stored.email.should.equal(users[0].email);
    });
    it('should be able to send support message', async () => {
      const job = await assertSendingSupportMessage();
      should(job.data.subject).equal(
        `Support request [Other] from ${users[0].username} (${users[0].displayName})`,
      );
      should(job.data.text).containEql('Authenticated: yes');
      should(job.data.text).containEql('Signup confirmed: yes');
    });
    it('should be able to report user in support message', async () => {
      const job = await assertSendingSupportMessage({
        reportMember: users[1].username,
      });
      should(job.data.text).containEql(users[1].username);
      const stored = await mongoose
        .model('SupportRequest')
        .findOne({ user: users[0]._id });
      stored.reportedUser.toString().should.equal(users[1]._id.toString());
    });
  });
  context('logged in as non-public user', () => {
    // Sign in and sign out
    beforeEach(function () {
      return utils.signIn.call(this, _usersNonPublic[0], agent);
    });
    afterEach(function () {
      return utils.signOut.call(this, agent);
    });
    it('should be able to send support message', async () => {
      const job = await assertSendingSupportMessage();
      should(job.data.subject).equal(
        `Support request [Other] from ${users[1].username} (${users[1].displayName})`,
      );
      should(job.data.text).containEql('Authenticated: yes');
      should(job.data.text).containEql('Signup confirmed: no');
    });
  });
});
