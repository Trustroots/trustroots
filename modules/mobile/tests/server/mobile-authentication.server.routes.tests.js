const request = require('supertest');
const mongoose = require('mongoose');
const should = require('should');
const express = require('../../../../config/lib/express');
const utils = require('../../../../testutils/server/data.server.testutil');

const User = mongoose.model('User');
const MobileSession = mongoose.model('MobileSession');
const MobileAuthenticationAttempt = mongoose.model(
  'MobileAuthenticationAttempt',
);

let app;
let member;
let credentials;

function createMember() {
  credentials = {
    username: 'mobile_member',
    password: 'strong-password',
  };
  member = new User({
    public: true,
    firstName: 'Mobile',
    lastName: 'Member',
    displayName: 'Mobile Member',
    email: 'mobile.member@example.org',
    username: credentials.username,
    password: credentials.password,
    provider: 'local',
    roles: ['user'],
  });
  return member.save();
}

describe('Mobile authentication API', function () {
  before(function () {
    app = express.init(mongoose.connection);
  });

  beforeEach(createMember);
  afterEach(utils.clearDatabase);

  it('reports the pre-release API contract and deployed build', async function () {
    const originalCommit = app.locals.appSettings.commit;
    app.locals.appSettings.commit = '1234abc';

    const response = await request(app)
      .get('/api/mobile/v0/status')
      .expect(200);

    response.body.contractVersion.should.equal('v0');
    response.body.buildVersion.should.match(/^v0\.1-\d{8}-\d{4}$/);
    response.body.startedAt.should.equal(app.locals.appSettings.time);
    response.body.revision.should.equal('1234abc');
    response.headers['cache-control'].should.equal('no-store');
    response.headers.pragma.should.equal('no-cache');

    app.locals.appSettings.commit = originalCommit;
  });

  it('signs in with an opaque token pair and returns the member email', async function () {
    const response = await request(app)
      .post('/api/mobile/v0/auth/signin')
      .send(credentials)
      .expect(200);

    response.body.accessToken.should.match(/^[a-f0-9]{64}$/);
    response.body.refreshToken.should.match(/^[a-f0-9]{64}$/);
    response.headers['cache-control'].should.equal('no-store');
    response.headers.pragma.should.equal('no-cache');
    should.not.exist(response.headers['set-cookie']);
    response.body.member.should.deepEqual({
      id: member._id.toString(),
      username: member.username,
      displayName: member.displayName,
      public: true,
      email: member.email,
      newsletter: false,
    });
    should.not.exist(response.body.member.password);

    const storedSession = await MobileSession.findOne({ user: member._id });
    storedSession.accessTokenHash.should.not.equal(response.body.accessToken);
    storedSession.refreshTokenHash.should.not.equal(response.body.refreshToken);
  });

  it('rejects incorrect credentials without revealing which part failed', async function () {
    const response = await request(app)
      .post('/api/mobile/v0/auth/signin')
      .send({ username: credentials.username, password: 'not-the-password' })
      .expect(401);

    response.body.message.should.equal('Mobile authentication is required.');
    response.body.code.should.equal('authentication_required');
  });

  it('rate limits repeated rejected sign-in attempts', async function () {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(app)
        .post('/api/mobile/v0/auth/signin')
        .send({ username: credentials.username, password: 'not-the-password' })
        .expect(401);
    }

    const response = await request(app)
      .post('/api/mobile/v0/auth/signin')
      .send({ username: credentials.username, password: 'not-the-password' })
      .expect(429);

    response.body.code.should.equal('rate_limited');
    response.headers['retry-after'].should.equal('900');
    const storedAttempt = await MobileAuthenticationAttempt.findOne({}).lean();
    storedAttempt.count.should.equal(11);
  });

  it('atomically rate limits parallel rejected sign-in attempts', async function () {
    const responses = await Promise.all(
      Array.from({ length: 20 }, function () {
        return request(app).post('/api/mobile/v0/auth/signin').send({
          username: credentials.username,
          password: 'not-the-password',
        });
      }),
    );

    responses
      .filter(function (response) {
        return response.status === 401;
      })
      .length.should.equal(10);
    responses
      .filter(function (response) {
        return response.status === 429;
      })
      .length.should.equal(10);
  });

  it('authenticates the current member with an access token', async function () {
    const signin = await request(app)
      .post('/api/mobile/v0/auth/signin')
      .send(credentials)
      .expect(200);

    const response = await request(app)
      .get('/api/mobile/v0/me')
      .set('Authorization', `Bearer ${signin.body.accessToken}`)
      .expect(200);

    response.body.member.username.should.equal(member.username);
    response.body.member.email.should.equal(member.email);
    response.headers['cache-control'].should.equal('no-store');
  });

  it('returns the signed-in member profile through the bearer API', async function () {
    member.tagline = 'A mobile profile';
    member.languages = ['eng'];
    await member.save();
    const signin = await request(app)
      .post('/api/mobile/v0/auth/signin')
      .send(credentials)
      .expect(200);

    const response = await request(app)
      .get(`/api/mobile/v0/profiles/${member.username}`)
      .set('Authorization', `Bearer ${signin.body.accessToken}`)
      .expect(200);

    response.body.profile.id.should.equal(member._id.toString());
    response.body.profile.username.should.equal(member.username);
    response.body.profile.tagline.should.equal(member.tagline);
    response.body.profile.languages.should.deepEqual(['eng']);
    response.body.profile.member.should.deepEqual([]);
    should.not.exist(response.body.profile.password);
    should.not.exist(response.body.profile.roles);
    response.headers['cache-control'].should.equal('no-store');
  });

  it('uses bearer authentication for mobile circles and memberships', async function () {
    const signin = await request(app)
      .post('/api/mobile/v0/auth/signin')
      .send(credentials)
      .expect(200);

    const circles = await request(app)
      .get('/api/mobile/v0/circles?limit=1')
      .set('Authorization', `Bearer ${signin.body.accessToken}`)
      .expect(200);
    circles.headers['cache-control'].should.equal('no-store');
    circles.body.should.be.an.Array();

    const memberships = await request(app)
      .get('/api/mobile/v0/memberships')
      .set('Authorization', `Bearer ${signin.body.accessToken}`)
      .expect(200);
    memberships.headers['cache-control'].should.equal('no-store');
    memberships.body.should.deepEqual([]);
  });

  it('does not allow cookie-free access to mobile offer resources', async function () {
    const response = await request(app)
      .get('/api/mobile/v0/offers')
      .expect(401);

    response.body.code.should.equal('authentication_required');
  });

  it('does not allow cookie-free access to contacts or experiences', async function () {
    const contactResponse = await request(app)
      .get(`/api/mobile/v0/contacts/${member._id}`)
      .expect(401);
    const experienceResponse = await request(app)
      .get(`/api/mobile/v0/experiences?userTo=${member._id}`)
      .expect(401);

    contactResponse.body.code.should.equal('authentication_required');
    experienceResponse.body.code.should.equal('authentication_required');
  });

  it('protects every remaining mobile member resource with bearer authentication', async function () {
    const protectedReads = [
      '/api/mobile/v0/memberships',
      `/api/mobile/v0/contacts/${member._id}`,
      `/api/mobile/v0/experiences?userTo=${member._id}`,
      `/api/mobile/v0/experiences/with/${member._id}`,
      '/api/mobile/v0/messages',
      `/api/mobile/v0/messages/${member._id}`,
    ];

    for (const path of protectedReads) {
      const response = await request(app).get(path).expect(401);
      response.body.code.should.equal('authentication_required');
    }

    const protectedWrites = [
      { method: 'post', path: '/api/mobile/v0/experiences' },
      { method: 'post', path: '/api/mobile/v0/messages' },
      { method: 'put', path: '/api/mobile/v0/account' },
      { method: 'put', path: '/api/mobile/v0/profile' },
      { method: 'post', path: '/api/mobile/v0/account/password' },
      { method: 'post', path: '/api/mobile/v0/support' },
    ];
    for (const requestDetails of protectedWrites) {
      const response = await request(app)
        [requestDetails.method](requestDetails.path)
        .expect(401);
      response.body.code.should.equal('authentication_required');
    }
  });

  it('runs mobile resource adapters only after bearer authentication', async function () {
    const signin = await request(app)
      .post('/api/mobile/v0/auth/signin')
      .send(credentials)
      .expect(200);
    const authenticated = {
      Authorization: `Bearer ${signin.body.accessToken}`,
    };

    await request(app)
      .get(`/api/mobile/v0/offers/${member._id}`)
      .set(authenticated)
      .expect(404);

    const contacts = await request(app)
      .get(`/api/mobile/v0/contacts/${member._id}`)
      .set(authenticated)
      .expect(200);
    contacts.body.should.deepEqual([]);

    await request(app)
      .get(`/api/mobile/v0/experiences/with/${member._id}`)
      .set(authenticated)
      .expect(404);

    const messages = await request(app)
      .get(`/api/mobile/v0/messages/${member._id}`)
      .set(authenticated)
      .expect(200);
    messages.body.should.deepEqual([]);
  });

  it('updates a profile through bearer authentication without creating a browser cookie', async function () {
    const signin = await request(app)
      .post('/api/mobile/v0/auth/signin')
      .send(credentials)
      .expect(200);

    const response = await request(app)
      .put('/api/mobile/v0/profile')
      .set('Authorization', `Bearer ${signin.body.accessToken}`)
      .send({ tagline: 'Updated from the native app.' })
      .expect(200);

    response.body.tagline.should.equal('Updated from the native app.');
    should.not.exist(response.headers['set-cookie']);
  });

  it("does not return another member's account details in a bearer profile", async function () {
    const otherMember = new User({
      public: true,
      firstName: 'Other',
      lastName: 'Member',
      displayName: 'Other Member',
      email: 'other.member@example.org',
      username: 'other_mobile_member',
      password: 'strong-password',
      provider: 'local',
      roles: ['user'],
      newsletter: true,
    });
    await otherMember.save();
    const signin = await request(app)
      .post('/api/mobile/v0/auth/signin')
      .send(credentials)
      .expect(200);

    const response = await request(app)
      .get(`/api/mobile/v0/profiles/${otherMember.username}`)
      .set('Authorization', `Bearer ${signin.body.accessToken}`)
      .expect(200);

    response.body.profile.should.not.have.property('email');
    should.not.exist(response.body.profile.emailTemporary);
    should.not.exist(response.body.profile.newsletter);
  });

  it('rejects malformed bearer tokens without accepting prefixes', async function () {
    const response = await request(app)
      .get('/api/mobile/v0/me')
      .set('Authorization', 'Bearer not-a-mobile-token')
      .expect(401);

    response.body.code.should.equal('authentication_required');
    response.headers['cache-control'].should.equal('no-store');
  });

  it('rotates refresh tokens and rejects the old refresh token', async function () {
    const signin = await request(app)
      .post('/api/mobile/v0/auth/signin')
      .send(credentials)
      .expect(200);

    const refreshed = await request(app)
      .post('/api/mobile/v0/auth/refresh')
      .send({ refreshToken: signin.body.refreshToken })
      .expect(200);

    refreshed.body.accessToken.should.not.equal(signin.body.accessToken);
    refreshed.body.refreshToken.should.not.equal(signin.body.refreshToken);
    refreshed.headers['cache-control'].should.equal('no-store');

    const rejected = await request(app)
      .post('/api/mobile/v0/auth/refresh')
      .send({ refreshToken: signin.body.refreshToken })
      .expect(401);
    rejected.body.code.should.equal('authentication_required');
  });

  it('rejects an expired refresh token without changing the session', async function () {
    const signin = await request(app)
      .post('/api/mobile/v0/auth/signin')
      .send(credentials)
      .expect(200);
    await MobileSession.updateOne(
      { user: member._id },
      { refreshExpiresAt: new Date(Date.now() - 1000) },
    );
    const before = await MobileSession.findOne({ user: member._id }).lean();

    const rejected = await request(app)
      .post('/api/mobile/v0/auth/refresh')
      .send({ refreshToken: signin.body.refreshToken })
      .expect(401);

    const after = await MobileSession.findOne({ user: member._id }).lean();
    rejected.body.code.should.equal('authentication_required');
    after.accessTokenHash.should.equal(before.accessTokenHash);
    after.refreshTokenHash.should.equal(before.refreshTokenHash);
  });

  it('rejects a suspended member before changing refresh tokens', async function () {
    const signin = await request(app)
      .post('/api/mobile/v0/auth/signin')
      .send(credentials)
      .expect(200);
    const before = await MobileSession.findOne({ user: member._id }).lean();
    await User.updateOne({ _id: member._id }, { roles: ['suspended'] });

    const rejected = await request(app)
      .post('/api/mobile/v0/auth/refresh')
      .send({ refreshToken: signin.body.refreshToken })
      .expect(401);

    const after = await MobileSession.findOne({ user: member._id }).lean();
    rejected.body.code.should.equal('authentication_required');
    after.accessTokenHash.should.equal(before.accessTokenHash);
    after.refreshTokenHash.should.equal(before.refreshTokenHash);
  });

  it('rejects a suspended member at sign-in', async function () {
    await User.updateOne({ _id: member._id }, { roles: ['suspended'] });

    const rejected = await request(app)
      .post('/api/mobile/v0/auth/signin')
      .send(credentials)
      .expect(401);

    rejected.body.code.should.equal('authentication_required');
    (await MobileSession.countDocuments({ user: member._id })).should.equal(0);
  });

  it('revokes an access token on sign-out', async function () {
    const signin = await request(app)
      .post('/api/mobile/v0/auth/signin')
      .send(credentials)
      .expect(200);

    await request(app)
      .post('/api/mobile/v0/auth/signout')
      .set('Authorization', `Bearer ${signin.body.accessToken}`)
      .expect(204);

    const rejected = await request(app)
      .get('/api/mobile/v0/me')
      .set('Authorization', `Bearer ${signin.body.accessToken}`)
      .expect(401);
    rejected.body.code.should.equal('authentication_required');
  });

  it('rejects an expired access token', async function () {
    const signin = await request(app)
      .post('/api/mobile/v0/auth/signin')
      .send(credentials)
      .expect(200);
    await MobileSession.updateOne(
      { user: member._id },
      { accessExpiresAt: new Date(Date.now() - 1000) },
    );

    const rejected = await request(app)
      .get('/api/mobile/v0/me')
      .set('Authorization', `Bearer ${signin.body.accessToken}`)
      .expect(401);
    rejected.body.code.should.equal('authentication_required');
  });
});
