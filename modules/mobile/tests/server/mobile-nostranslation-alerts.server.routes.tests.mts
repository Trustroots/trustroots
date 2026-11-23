import mongoose from 'mongoose';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import request from 'supertest';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import config from '../../../../config/config.mts';
import express from '../../../../config/lib/express.mts';
import { clearDatabase } from '../../../../testutils/server/data.server.testutil.mts';

const path = '/api/mobile/v0/nostranslation/alerts';
const secret = generateSecretKey();
const transport = getPublicKey(secret);
const author = getPublicKey(generateSecretKey());
const destination = { platform: 'ios', token: 'ab'.repeat(32) };
const registration = { author, transport, destination };
const User = mongoose.model('User');

let app: Awaited<ReturnType<typeof express.init>>;
const initialFlag = config.featureFlags.nostranslationAlerts;
const initialHttps = config.https;

async function signIn() {
  const response = await request(app)
    .post('/api/mobile/v0/auth/signin')
    .send({ username: 'reviewmember', password: 'strong-fixture-password' })
    .expect(200);
  return 'Bearer ' + response.body.accessToken;
}

describe('Mobile Nostranslation alert registrations', () => {
  beforeAll(async () => {
    app = await express.init(mongoose.connection);
  });

  beforeEach(async () => {
    config.featureFlags.nostranslationAlerts = true;
    await User.create({
      public: true,
      firstName: 'Review',
      lastName: 'Member',
      displayName: 'Review Member',
      email: 'review-member@example.test',
      username: 'reviewmember',
      password: 'strong-fixture-password',
      provider: 'local',
      roles: ['user'],
    });
  });

  afterEach(async () => {
    config.featureFlags.nostranslationAlerts = initialFlag;
    config.https = initialHttps;
    vi.restoreAllMocks();
    await clearDatabase();
  });

  it('exposes capabilities only to an authenticated mobile session', async () => {
    await request(app).get(path).expect(401);
    await request(app)
      .post(path + '/challenge')
      .send(registration)
      .expect(401);
    const auth = await signIn();
    const available = await request(app)
      .get(path)
      .set('Authorization', auth)
      .expect(200);
    expect(available.body.androidVapidKey).toEqual(config.webPush.publicKey);
    config.featureFlags.nostranslationAlerts = false;
    const disabled = await request(app)
      .get(path)
      .set('Authorization', auth)
      .expect(200);
    expect(disabled.body).toEqual({ androidVapidKey: null, ios: false });
    await request(app)
      .post(path + '/challenge')
      .set('Authorization', auth)
      .send(registration)
      .expect(404);
    await request(app)
      .put(path)
      .set('Authorization', auth)
      .send(registration)
      .expect(404);
  });

  it('binds proof to the mobile session, transport key and device, then consumes it once', async () => {
    const auth = await signIn();
    const otherSession = await signIn();
    const challenge = await request(app)
      .post(path + '/challenge')
      .set('Authorization', auth)
      .send(registration)
      .expect(200);
    const proof = finalizeEvent(challenge.body.event, secret);
    const data = { ...registration, proof };

    await request(app)
      .put(path)
      .set('Authorization', otherSession)
      .send(data)
      .expect(400);
    await request(app)
      .put(path)
      .set('Authorization', auth)
      .send({
        ...data,
        destination: { ...destination, token: 'cd'.repeat(32) },
      })
      .expect(400);
    await request(app)
      .put(path)
      .set('Authorization', auth)
      .send({
        ...data,
        proof: finalizeEvent(
          structuredClone(challenge.body.event),
          generateSecretKey(),
        ),
      })
      .expect(400);
    await request(app)
      .put(path)
      .set('Authorization', auth)
      .send(data)
      .expect(204);
    await request(app)
      .put(path)
      .set('Authorization', auth)
      .send(data)
      .expect(400);
    const rows = mongoose.model('NostranslationAlertRegistration');
    expect(await rows.findById(transport).lean()).toMatchObject({
      _id: transport,
      author,
      destination,
      expiresAt: expect.any(Date),
    });
    await request(app)
      .delete(path)
      .set('Authorization', otherSession)
      .send({ transport })
      .expect(204);
    expect(await rows.countDocuments()).toBe(1);
    await request(app)
      .delete(path)
      .set('Authorization', auth)
      .send({ transport })
      .expect(204);
    expect(await rows.countDocuments()).toBe(0);
  });

  it('rejects the member key as a transport and disallowed UnifiedPush endpoints', async () => {
    const auth = await signIn();
    for (const invalid of [
      { ...registration, author: transport },
      {
        ...registration,
        destination: {
          platform: 'android',
          endpoint: 'https://unsupported.example.test/push',
          publicKey: 'a'.repeat(86),
          auth: 'a'.repeat(22),
        },
      },
    ]) {
      await request(app)
        .post(path + '/challenge')
        .set('Authorization', auth)
        .send(invalid)
        .expect(400, { message: 'Invalid notification registration.' });
    }
    await request(app)
      .put(path)
      .set('Authorization', auth)
      .send(registration)
      .expect(400, { message: 'Invalid notification registration proof.' });
    await request(app)
      .delete(path)
      .set('Authorization', auth)
      .send({ transport: { $ne: '' } })
      .expect(400);
    await request(app)
      .delete(path)
      .set('Authorization', auth)
      .send({ transport: 'invalid' })
      .expect(400, { message: 'Invalid transport key.' });
  });

  it('registers a valid Android destination only with the original, unexpired challenge', async () => {
    const auth = await signIn();
    const androidRegistration = {
      ...registration,
      destination: {
        platform: 'android',
        endpoint: 'https://ntfy.sh/translation-fixture',
        publicKey:
          'BNPRQG83KHuc4ZkSKlmSKQWC3PQm2YD-yOiPdjFbQyB8VM6ZZSLD2caRpXad6G_2qXqb_WUz7V2T7w1KqAXbslQ',
        auth: 'abcdefghijklmnopqrstuv',
      },
    };
    const newChallenge = async () => {
      const response = await request(app)
        .post(path + '/challenge')
        .set('Authorization', auth)
        .send(androidRegistration)
        .expect(200);
      return finalizeEvent(response.body.event, secret);
    };
    const proof = await newChallenge();
    for (const change of [
      { endpoint: 'https://ntfy.sh/other-translation-fixture' },
      { auth: 'abcdefghijklmnopqrstuw' },
    ]) {
      await request(app)
        .put(path)
        .set('Authorization', auth)
        .send({
          ...androidRegistration,
          destination: { ...androidRegistration.destination, ...change },
          proof,
        })
        .expect(400);
    }
    for (const [name, value] of [
      ['u', 'https://example.test' + path],
      ['method', 'POST'],
      ['payload', '0'.repeat(64)],
    ] as const) {
      const wrongBinding = finalizeEvent(
        {
          ...proof,
          tags: proof.tags.map(tag => (tag[0] === name ? [name, value] : tag)),
        },
        secret,
      );
      await request(app)
        .put(path)
        .set('Authorization', auth)
        .send({ ...androidRegistration, proof: wrongBinding })
        .expect(400);
    }
    for (const invalidProof of [
      { ...proof, sig: '0'.repeat(128) },
      finalizeEvent(
        {
          ...proof,
          tags: proof.tags.map(tag =>
            tag[0] === 'challenge' ? ['unknown', tag[1]!] : tag,
          ),
        },
        secret,
      ),
      finalizeEvent(
        {
          ...proof,
          tags: proof.tags.map(tag =>
            tag[0] === 'challenge' ? ['challenge', 'invalid'] : tag,
          ),
        },
        secret,
      ),
    ]) {
      await request(app)
        .put(path)
        .set('Authorization', auth)
        .send({ ...androidRegistration, proof: invalidProof })
        .expect(400);
    }
    const nonce = proof.tags.find(tag => tag[0] === 'challenge')![1];
    await mongoose
      .model('NostranslationAlertChallenge')
      .updateOne({ _id: { $eq: nonce } }, { $set: { expiresAt: new Date(0) } });
    await request(app)
      .put(path)
      .set('Authorization', auth)
      .send({ ...androidRegistration, proof })
      .expect(400);

    await request(app)
      .put(path)
      .set('Authorization', auth)
      .send({ ...androidRegistration, proof: await newChallenge() })
      .expect(204);
    expect(
      await mongoose
        .model('NostranslationAlertRegistration')
        .findById(transport)
        .lean(),
    ).toMatchObject({ destination: androidRegistration.destination });
  });

  it('preserves another member’s destination when a conflicting proof is submitted', async () => {
    const auth = await signIn();
    config.https = true;
    const challenge = await request(app)
      .post(path + '/challenge')
      .set('Authorization', auth)
      .send(registration)
      .expect(200);
    expect(challenge.body.event.tags).toContainEqual([
      'u',
      'https://' + config.domain + path,
    ]);
    const rows = mongoose.model('NostranslationAlertRegistration');
    const owner = new mongoose.Types.ObjectId();
    await rows.create({
      _id: transport,
      user: owner,
      session: new mongoose.Types.ObjectId(),
      author,
      destination,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await request(app)
      .put(path)
      .set('Authorization', auth)
      .send({
        ...registration,
        proof: finalizeEvent(challenge.body.event, secret),
      })
      .expect(400);
    expect(await rows.findById(transport).lean()).toMatchObject({
      user: owner,
    });
  });

  it('returns a server error on a database failure and still consumes the submitted proof', async () => {
    const auth = await signIn();
    const challenge = await request(app)
      .post(path + '/challenge')
      .set('Authorization', auth)
      .send(registration)
      .expect(200);
    const rows = mongoose.model('NostranslationAlertRegistration');
    vi.spyOn(rows, 'updateOne').mockRejectedValueOnce(
      new Error('Database unavailable.'),
    );
    const data = {
      ...registration,
      proof: finalizeEvent(challenge.body.event, secret),
    };
    await request(app)
      .put(path)
      .set('Authorization', auth)
      .send(data)
      .expect(500);
    await request(app)
      .put(path)
      .set('Authorization', auth)
      .send(data)
      .expect(400);
    expect(await rows.findById(transport)).toBeNull();
  });
});
