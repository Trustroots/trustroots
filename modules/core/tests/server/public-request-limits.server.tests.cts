const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose: typeof import('mongoose') = require('mongoose');
const request: typeof import('supertest') = require('supertest');
const sinon: typeof import('sinon') = require('sinon');
const requestLimitService: typeof import('../../server/services/targeted-request-limits.server.service.mts').default = require('../../server/services/targeted-request-limits.server.service.mjs');
const config: typeof import('../../../../config/config.mts').default = require('../../../../config/config.mts');
const express: import('../../../../testutils/server/model-contracts.mts').TestExpressModule = require('../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mjs') = require('../../../../testutils/server/data.server.testutil');
const testutils: typeof import('../../../../testutils/server/server.testutil.mts') = require('../../../../testutils/server/server.testutil');

describe('Signup and support request allowances', () => {
  const sandbox = sinon.createSandbox();
  const jobs = testutils.catchJobs();
  let app: import('../../../../testutils/server/model-contracts.mts').TestExpressApp;
  let originalSignup: typeof config.targetedRequestLimits.signup;
  let originalSupport: typeof config.targetedRequestLimits.support;
  before(async () => {
    app = await express.init(mongoose.connection);
  });
  beforeEach(() => {
    // Keep requests in one window with expiry ahead of MongoDB's real clock.
    const now = Date.now() + 60_000;
    const consume = requestLimitService.consume;
    sandbox
      .stub(requestLimitService, 'consume')
      .callsFake(options => consume({ ...options, now }));
    originalSignup = config.targetedRequestLimits.signup;
    originalSupport = config.targetedRequestLimits.support;
    jobs.length = 0;
  });
  afterEach(async () => {
    sandbox.restore();
    config.targetedRequestLimits.signup = originalSignup;
    config.targetedRequestLimits.support = originalSupport;
    await utils.clearDatabase();
  });

  function signup(email: string) {
    return {
      ageConfirmed: true,
      firstName: 'Amina',
      lastName: 'Vale',
      // Selection policy allows letters and numbers only; emails may still use hyphens.
      username: email.split('@')[0].replace(/[^A-Za-z0-9]/g, ''),
      email,
      password: 'fictional-password-123',
    };
  }

  it('limits signup per client before creating another account or email', async () => {
    config.targetedRequestLimits.signup = {
      windowMs: 60000,
      ipLimit: 1,
      identityLimit: 10,
    };
    await request(app)
      .post('/api/auth/signup')
      .send(signup('first-member@example.org'))
      .expect(200);
    const queued = jobs.length;
    const response = await request(app)
      .post('/api/auth/signup')
      .send(signup('second-member@example.org'))
      .expect(429);
    assert.match(response.headers['retry-after'], /^\d+$/);
    assert.equal(await mongoose.model('User').countDocuments(), 1);
    assert.equal(jobs.length, queued);
  });

  it('shares the signup recipient allowance across client addresses', async () => {
    config.targetedRequestLimits.signup = {
      windowMs: 60000,
      ipLimit: 10,
      identityLimit: 1,
    };
    await request(app)
      .post('/api/auth/signup')
      .set('!~Passenger-Client-Address', '198.51.100.21')
      .send(signup('recipient@example.org'))
      .expect(200);
    const queued = jobs.length;
    await request(app)
      .post('/api/auth/signup')
      .set('!~Passenger-Client-Address', '198.51.100.22')
      .send({
        ...signup('recipient@example.org'),
        email: 'Recipient@Example.org',
      })
      .expect(429);
    assert.equal(await mongoose.model('User').countDocuments(), 1);
    assert.equal(jobs.length, queued);
    const counters = await mongoose.model('RequestLimit').find({}).lean();
    assert.ok(
      counters.every(counter => !counter.key.includes('recipient@example.org')),
    );
  });

  it('limits anonymous support before storing or emailing another request', async () => {
    config.targetedRequestLimits.support = {
      windowMs: 60000,
      ipLimit: 1,
      identityLimit: 10,
    };
    const body = {
      email: 'support-sender@example.org',
      message: 'A fictional support enquiry.',
    };
    await request(app).post('/api/support').send(body).expect(200);
    const queued = jobs.length;
    const response = await request(app)
      .post('/api/support')
      .send(body)
      .expect(429);
    assert.match(response.headers['retry-after'], /^\d+$/);
    assert.equal(await mongoose.model('SupportRequest').countDocuments(), 1);
    assert.equal(jobs.length, queued);
  });

  it('shares signed-in support allowance across client addresses', async () => {
    config.targetedRequestLimits.support = {
      windowMs: 60000,
      ipLimit: 10,
      identityLimit: 1,
    };
    const [credentials] = utils.generateUsers(1, { public: true });
    await utils.saveUsers([credentials]);
    const agent = request.agent(app);
    await utils.signIn(credentials, agent);
    const body = { message: 'A fictional member enquiry.' };
    await agent
      .post('/api/support')
      .set('!~Passenger-Client-Address', '198.51.100.31')
      .send(body)
      .expect(200);
    const queued = jobs.length;
    await agent
      .post('/api/support')
      .set('!~Passenger-Client-Address', '198.51.100.32')
      .send(body)
      .expect(429);
    assert.equal(await mongoose.model('SupportRequest').countDocuments(), 1);
    assert.equal(jobs.length, queued);
  });
});
