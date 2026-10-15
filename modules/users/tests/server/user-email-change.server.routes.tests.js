const mongoose = require('mongoose');
const request = require('supertest');
const should = require('should');

const express = require('./../../../../config/lib/express.mjs');
const dataUtils = require('../../../../testutils/server/data.server.testutil');
const testUtils = require('../../../../testutils/server/server.testutil');
const mfaService = require('../../server/services/mfa.server.service.mjs');
const User = mongoose.model('User');

describe('Account email change routes', () => {
  let app;
  let agent;
  let user;
  let credentials;
  const jobs = testUtils.catchJobs();

  before(async () => {
    app = await express.init(mongoose.connection);
  });

  beforeEach(async () => {
    jobs.length = 0;
    agent = request.agent(app);
    [user] = dataUtils.generateUsers(1, { public: true });
    user.password = 'EmailChangePassword123!';
    credentials = { username: user.username, password: user.password };
    [user] = await dataUtils.saveUsers([user]);
    user = await User.findById(user._id);
  });

  afterEach(async () => {
    jobs.length = 0;
    await dataUtils.clearDatabase();
  });

  async function signIn() {
    await dataUtils.signIn(credentials, agent);
  }

  function tokenFromConfirmationEmail() {
    const job = jobs
      .filter(item => item.data.subject === 'Confirm email change')
      .at(-1);
    const match = job?.data.text.match(/confirm-email\/([a-f0-9]{64})/);
    should.exist(match);
    return match[1];
  }

  it('stages a credential-confirmed email change and notifies both addresses', async () => {
    await signIn();
    const response = await agent
      .post('/api/users/email-change')
      .send({
        email: '  new@example.test  ',
        currentPassword: credentials.password,
      })
      .expect(200);

    response.body.email.should.equal(user.email);
    response.body.emailTemporary.should.equal('new@example.test');
    should.not.exist(response.body.emailToken);
    const saved = await User.findById(user._id);
    saved.email.should.equal(user.email);
    saved.emailTemporary.should.equal('new@example.test');
    saved.emailToken.should.not.equal(tokenFromConfirmationEmail());
    saved.emailTokenIssuedAt.should.be.a.Date();
    saved.emailTokenExpires
      .getTime()
      .should.equal(saved.emailTokenIssuedAt.getTime() + 24 * 60 * 60 * 1000);
    jobs.length.should.equal(2);

    const confirmation = jobs.find(
      item => item.data.subject === 'Confirm email change',
    );
    confirmation.data.to.address.should.equal('new@example.test');
    const notification = jobs.find(
      item =>
        item.data.subject ===
        'Email change requested for your Trustroots account',
    );
    notification.data.to.address.should.equal(user.email);
    notification.data.text.should.not.containEql('new@example.test');
    notification.data.text.should.not.containEql(tokenFromConfirmationEmail());
  });

  it('requires the current password and leaves the email unchanged on failure', async () => {
    await signIn();
    const response = await agent
      .post('/api/users/email-change')
      .send({
        email: 'new@example.test',
        currentPassword: 'incorrect-password',
      })
      .expect(400);

    response.body.message.should.equal(
      'Password or authenticator confirmation failed.',
    );
    const saved = await User.findById(user._id);
    saved.email.should.equal(user.email);
    saved.emailTemporary.should.equal('');
    jobs.length.should.equal(0);
  });

  it('rejects changing email through the general profile update route', async () => {
    await signIn();
    await agent
      .put('/api/users')
      .send({ email: 'new@example.test' })
      .expect(400);
    const saved = await User.findById(user._id);
    saved.email.should.equal(user.email);
    saved.emailTemporary.should.equal('');
  });

  it('requires and consumes an MFA recovery code when MFA is enabled', async () => {
    const recoveryCodes = ['AABBCCDDEEFF0123', '1122334455667788'];
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          roles: ['user', 'admin'],
        },
      },
    );
    await dataUtils.signInPrivileged(credentials, agent);
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          mfaRecoveryCodeHashes: recoveryCodes.map(code =>
            mfaService.hashRecoveryCode(code),
          ),
        },
      },
    );
    await agent
      .post('/api/users/email-change')
      .send({
        email: 'new@example.test',
        currentPassword: credentials.password,
      })
      .expect(400);
    const response = await agent
      .post('/api/users/email-change')
      .send({
        email: 'new@example.test',
        currentPassword: credentials.password,
        mfaCode: recoveryCodes[1],
      })
      .expect(200);
    response.body.emailTemporary.should.equal('new@example.test');

    const repeated = await agent
      .post('/api/users/email-change')
      .send({
        email: 'another@example.test',
        currentPassword: credentials.password,
        mfaCode: recoveryCodes[1],
      })
      .expect(400);
    repeated.body.message.should.equal(
      'Password or authenticator confirmation failed.',
    );
  });

  it('invalidates replaced confirmation tokens and applies only the current one', async () => {
    await signIn();
    await agent
      .post('/api/users/email-change')
      .send({
        email: 'first@example.test',
        currentPassword: credentials.password,
      })
      .expect(200);
    const firstToken = tokenFromConfirmationEmail();

    await agent
      .post('/api/users/email-change')
      .send({
        email: 'second@example.test',
        currentPassword: credentials.password,
      })
      .expect(200);
    const currentToken = tokenFromConfirmationEmail();
    currentToken.should.not.equal(firstToken);

    await request(app)
      .post(`/api/auth/confirm-email/${firstToken}`)
      .send({})
      .expect(400);
    const stillPending = await User.findById(user._id);
    stillPending.email.should.equal(user.email);
    stillPending.emailTemporary.should.equal('second@example.test');

    await request(app)
      .post(`/api/auth/confirm-email/${currentToken}`)
      .send({})
      .expect(200);
    const confirmed = await User.findById(user._id);
    confirmed.email.should.equal('second@example.test');
    confirmed.emailTemporary.should.equal('');
    should.not.exist(confirmed.emailToken);
    await agent.get('/api/auth/sessions').expect(403);
  });

  it('cancels a pending change and prevents its confirmation token from applying', async () => {
    await signIn();
    await agent
      .post('/api/users/email-change')
      .send({
        email: 'pending@example.test',
        currentPassword: credentials.password,
      })
      .expect(200);
    const token = tokenFromConfirmationEmail();

    const response = await agent
      .delete('/api/users/email-change')
      .send({})
      .expect(200);
    response.body.email.should.equal(user.email);
    response.body.emailTemporary.should.equal('');
    const cancelled = await User.findById(user._id);
    cancelled.email.should.equal(user.email);
    cancelled.emailTemporary.should.equal('');
    should.not.exist(cancelled.emailToken);
    should.not.exist(cancelled.emailTokenIssuedAt);
    should.not.exist(cancelled.emailTokenExpires);
    await request(app)
      .post(`/api/auth/confirm-email/${token}`)
      .send({})
      .expect(400);
  });
});
