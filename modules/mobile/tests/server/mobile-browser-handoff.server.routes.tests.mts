import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import sinon from 'sinon';
import config from '../../../../config/config.mts';
import express from '../../../../config/lib/express.mts';
import { clearDatabase } from '../../../../testutils/server/data.server.testutil.mts';
import {
  encryptSecret,
  hashRecoveryCode,
} from '../../../users/server/services/mfa.server.service.mjs';

const Handoff = mongoose.model('MobileBrowserHandoff');
const Session = mongoose.model('MobileSession');
const User = mongoose.model('User');
const credentials = {
  username: 'phonefixture',
  password: 'FictionalPassword123!',
};
const recoveryCode = '1A2B3C4D5E6F7A8B';
const fixtureTotpSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const exchangePath = '/api/mobile/v0/auth/browser/exchange';

function fixtureTotp() {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac('sha1', '12345678901234567890')
    .update(counter)
    .digest();
  const offset = digest[digest.length - 1] & 15;
  return String(
    (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000,
  ).padStart(6, '0');
}

describe('Mobile browser sign-in handoff', () => {
  let app: Awaited<ReturnType<typeof express.init>>;
  let user: InstanceType<typeof User>;

  before(async () => {
    app = await express.init(mongoose.connection);
  });
  beforeEach(async () => {
    user = await User.create({
      ...credentials,
      email: 'phonefixture@example.test',
      firstName: 'Fictional',
      lastName: 'Member',
      displayName: 'Fictional Member',
      provider: 'local',
      roles: ['user', 'admin'],
      public: true,
    });
  });
  afterEach(() => sinon.restore());
  afterEach(clearDatabase);

  function transaction(platform = 'ios') {
    const codeVerifier = randomBytes(32).toString('base64url');
    const state = randomBytes(32).toString('base64url');
    const query = {
      platform,
      state,
      code_challenge: createHash('sha256')
        .update(codeVerifier)
        .digest('base64url'),
    };
    return { query, codeVerifier, state };
  }

  async function start(platform = 'ios') {
    const flow = transaction(platform);
    const response = await request(app)
      .get('/auth/mobile/start')
      .query(flow.query)
      .expect(303);
    assert.equal(response.headers['referrer-policy'], 'no-referrer');
    assert.equal(response.headers['cache-control'], 'no-store');
    const signin = new URL(response.headers.location, 'https://example.test');
    assert.equal(signin.pathname, '/signin');
    assert.equal(signin.searchParams.get('continue'), 'true');
    const confirmation = signin.searchParams.get('returnTo');
    assert.ok(confirmation);
    return { ...flow, confirmation };
  }

  async function authorize(platform = 'ios') {
    const flow = await start(platform);
    const browser = request.agent(app);
    await browser.post('/api/auth/signin').send(credentials).expect(200);
    const current = await browser.get('/api/auth/session').expect(200);
    assert.equal(current.body.userId, user._id.toString());
    const { text } = await browser.get(flow.confirmation).expect(200);
    assert.match(text, /Fictional|phonefixture/);
    const csrf = text.match(/name="csrf" value="([a-f0-9]{64})"/)?.[1];
    assert.ok(csrf);
    return { ...flow, browser, csrf };
  }

  async function issue(flow: Awaited<ReturnType<typeof authorize>>) {
    const response = await flow.browser
      .post(flow.confirmation)
      .type('form')
      .send({ csrf: flow.csrf })
      .expect(200);
    const href = response.text.match(/href="([^"]+)"/)?.[1];
    assert.ok(href);
    const target = new URL(href.replace('&amp;', '&'));
    assert.equal(
      `${target.protocol}//${target.host}${target.pathname}`,
      'org.trustroots.mobile://auth/complete',
    );
    assert.equal(target.searchParams.get('state'), flow.state);
    const code = target.searchParams.get('code');
    assert.ok(code);
    assert.match(code, /^[A-Za-z0-9_-]{43}$/);
    return {
      code,
      codeVerifier: flow.codeVerifier,
      platform: flow.query.platform,
    };
  }

  it.each(['authenticator', 'recovery'] as const)(
    'requires a fresh %s code, redeems once, and keeps the mobile session verified across refresh',
    async factor => {
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            mfaEnabled: true,
            mfaSecretEncrypted: encryptSecret(fixtureTotpSecret),
            mfaLastTotpCounter: -1,
            mfaRecoveryCodeHashes: [hashRecoveryCode(recoveryCode)],
          },
        },
      );
      const flow = await start();
      const browser = request.agent(app);
      await browser.post('/api/auth/signin').send(credentials).expect(202);
      await browser.get(flow.confirmation).expect(303);
      await browser
        .post('/api/auth/mfa/verify')
        .set('X-Trustroots-Request', '1')
        .send({
          code: factor === 'authenticator' ? fixtureTotp() : recoveryCode,
        })
        .expect(200);
      const consent = await browser.get(flow.confirmation).expect(200);
      const csrf = consent.text.match(
        /name="csrf" value="([a-f0-9]{64})"/,
      )?.[1];
      assert.ok(csrf);
      const input = await issue({ ...flow, browser, csrf });
      const unrelatedProof = randomBytes(32).toString('base64url');
      await request(app)
        .post(exchangePath)
        .send({ ...input, codeVerifier: unrelatedProof })
        .expect(401);
      const results = await Promise.all([
        request(app).post(exchangePath).send(input),
        request(app).post(exchangePath).send(input),
      ]);
      assert.deepEqual(
        results.map(response => response.status).sort(),
        [200, 401],
      );
      const success = results.find(result => result.status === 200)!;
      assert.deepEqual(Object.keys(success.body).sort(), [
        'accessToken',
        'accessTokenExpiresAt',
        'member',
        'refreshToken',
      ]);
      assert.equal(success.headers['set-cookie'], undefined);
      assert.equal(success.body.member.id, user._id.toString());
      const session = await Session.findOne({ user: user._id });
      assert.equal(session?.mfaVerified, true);
      assert.equal(await Handoff.countDocuments(), 0);
      await request(app)
        .get('/api/mobile/v0/me')
        .set('Authorization', `Bearer ${success.body.accessToken}`)
        .expect(200);
      const refreshed = await request(app)
        .post('/api/mobile/v0/auth/refresh')
        .send({ refreshToken: success.body.refreshToken })
        .expect(200);
      await request(app)
        .get('/api/mobile/v0/me')
        .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
        .expect(200);
      await User.updateOne({ _id: user._id }, { $inc: { authVersion: 1 } });
      await request(app)
        .post('/api/mobile/v0/auth/refresh')
        .send({ refreshToken: refreshed.body.refreshToken })
        .expect(401);
    },
  );

  it('requires explicit same-session POST confirmation and issues only once', async () => {
    await User.updateOne({ _id: user._id }, { $set: { authVersion: null } });
    const flow = await authorize();
    await flow.browser
      .post(flow.confirmation)
      .type('form')
      .send({})
      .expect(403);
    await request(app)
      .post(flow.confirmation)
      .type('form')
      .send({ csrf: flow.csrf })
      .expect(403);
    await flow.browser
      .post(flow.confirmation)
      .set('Origin', 'https://invalid.example')
      .type('form')
      .send({ csrf: flow.csrf })
      .expect(403);
    assert.equal(await Session.countDocuments(), 0);
    await flow.browser
      .post('/auth/mobile/confirm/invalid')
      .type('form')
      .send({ csrf: flow.csrf })
      .expect(400);
    const claim = sinon.stub(Handoff, 'findOneAndUpdate').resolves(null);
    await flow.browser
      .post(flow.confirmation)
      .type('form')
      .send({ csrf: flow.csrf })
      .expect(400);
    claim.restore();
    const input = await issue(flow);
    await flow.browser.get(flow.confirmation).expect(400);
    await flow.browser
      .post(flow.confirmation)
      .type('form')
      .send({ csrf: flow.csrf })
      .expect(400);
    const exchanged = await request(app)
      .post(exchangePath)
      .send(input)
      .expect(200);
    assert.equal(exchanged.body.member.username, credentials.username);
    assert.equal(
      (await Session.findOne({ user: user._id }))?.mfaVerified,
      false,
    );
  });

  it('requires a new sign-in even when the browser already has an authenticated session', async () => {
    const previous = await authorize();
    const { browser } = previous;
    const flow = await start();
    const stale = await browser.get(flow.confirmation).expect(303);
    assert.match(stale.headers.location, /^\/signin\?/);
    await browser
      .post(flow.confirmation)
      .type('form')
      .send({ csrf: previous.csrf })
      .expect(400);
    await browser.post('/api/auth/signin').send(credentials).expect(200);
    await browser.get(flow.confirmation).expect(200);
  });

  it('rejects invalid inputs, expired requests and credential changes', async () => {
    const { query } = transaction();
    await request(app)
      .get('/auth/mobile/start')
      .query({ ...query, platform: 'other' })
      .expect(400);
    await request(app)
      .get('/auth/mobile/start')
      .query({ ...query, code_challenge: 'short' })
      .expect(400);
    await request(app)
      .get('/auth/mobile/start')
      .query({ ...query, state: 'short' })
      .expect(400);
    await request(app).get('/auth/mobile/confirm/invalid').expect(400);
    await request(app)
      .post(exchangePath)
      .set('X-Trustroots-Request', '1')
      .expect(401);
    await request(app).post(exchangePath).send({}).expect(401);
    const flow = await authorize();
    const input = await issue(flow);
    await request(app)
      .post(exchangePath)
      .send({ ...input, code: 'bad' })
      .expect(401);
    await request(app)
      .post(exchangePath)
      .send({ ...input, codeVerifier: 'bad' })
      .expect(401);
    await User.updateOne({ _id: user._id }, { $inc: { authVersion: 1 } });
    await request(app).post(exchangePath).send(input).expect(401);
    const expired = await authorize();
    const expiredInput = await issue(expired);
    await Handoff.updateOne({}, { $set: { expiresAt: new Date(0) } });
    await request(app).post(exchangePath).send(expiredInput).expect(401);
    assert.equal(await Session.countDocuments(), 0);
  });

  it('does not give an unenrolled browser handoff to a newly enrolled or suspended account', async () => {
    const prior = await issue(await authorize());
    await User.updateOne({ _id: user._id }, { $set: { mfaEnabled: true } });
    await request(app).post(exchangePath).send(prior).expect(401);

    await User.updateOne({ _id: user._id }, { $set: { mfaEnabled: false } });
    const pending = await issue(await authorize());
    await User.updateOne(
      { _id: user._id },
      { $set: { roles: ['user', 'suspended'] } },
    );
    await request(app).post(exchangePath).send(pending).expect(401);
    assert.equal(await Session.countDocuments(), 0);
  });

  it('consumes the handoff even when the resulting session cannot be saved', async () => {
    const input = await issue(await authorize());
    sinon
      .stub(Session.prototype, 'save')
      .rejects(new Error('database unavailable'));
    await request(app).post(exchangePath).send(input).expect(500);
    await request(app).post(exchangePath).send(input).expect(401);
  });

  it('does not render a legacy username as browser markup', async () => {
    await User.collection.updateOne(
      { _id: user._id },
      { $set: { username: '<legacy>' } },
    );
    const flow = await start();
    const browser = request.agent(app);
    await browser
      .post('/api/auth/signin')
      .send({
        username: 'phonefixture@example.test',
        password: credentials.password,
      })
      .expect(200);
    const consent = await browser.get(flow.confirmation).expect(200);
    assert.doesNotMatch(consent.text, /<legacy>/);
  });

  it('uses only the configured Android App Link and shows an explicit return link', async () => {
    const { query } = transaction('android');
    await request(app).get('/auth/mobile/start').query(query).expect(400);
    sinon.stub(config, 'domain').value('www.trustroots.org');
    const flow = await authorize('android');
    const response = await flow.browser
      .post(flow.confirmation)
      .type('form')
      .send({ csrf: flow.csrf })
      .expect(200);
    const href = response.text.match(/href="([^"]+)"/)?.[1];
    assert.ok(href);
    const target = new URL(href.replace('&amp;', '&'));
    assert.equal(target.origin, 'https://www.trustroots.org');
    assert.equal(target.pathname, '/mobile-auth/complete');
    assert.equal(target.searchParams.get('state'), flow.state);
    const body = {
      code: target.searchParams.get('code'),
      codeVerifier: flow.codeVerifier,
    };
    const fallback = await request(app)
      .get(target.pathname + target.search)
      .expect(200);
    assert.equal(fallback.headers['cache-control'], 'no-store');
    assert.equal(fallback.headers['referrer-policy'], 'no-referrer');
    assert.match(fallback.text, /open supported links in Android Settings/);
    assert.ok(body.code);
    assert.ok(!fallback.text.includes(body.code));
    await request(app)
      .post(exchangePath)
      .send({ ...body, platform: 'ios' })
      .expect(401);
    await request(app)
      .post(exchangePath)
      .send({ ...body, platform: 'android' })
      .expect(200);
  });
});
