import { createHash } from 'node:crypto';
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
import translationAlerts from '../../server/controllers/mobile-nostranslation-alerts.server.controller.cjs';
import { alertRegistrations } from '../../server/services/nostranslation-alert-registration.server.service.mts';

const path = '/api/mobile/v0/nostranslation/alerts';
const secret = generateSecretKey();
const transport = getPublicKey(secret);
const authorSecret = generateSecretKey();
const author = getPublicKey(authorSecret);
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

  it('returns a validation error if an unregister handler has no request body', async () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    await translationAlerts.unregister(
      {
        mobileUser: { _id: new mongoose.Types.ObjectId() },
        mobileSession: {
          _id: new mongoose.Types.ObjectId(),
          refreshExpiresAt: new Date(),
        },
      },
      { status },
    );
    expect(status).toHaveBeenCalledExactlyOnceWith(400);
    expect(json).toHaveBeenCalledExactlyOnceWith({
      message: 'Invalid transport key.',
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

  it('shares the write allowance across sessions and leaves opt-out available', async () => {
    const auth = await signIn();
    const otherSession = await signIn();
    const policy = config.targetedRequestLimits.nostranslationAlertWrite;
    const original = policy.identityLimit;
    policy.identityLimit = 1;
    try {
      await request(app)
        .post(path + '/challenge')
        .set('Authorization', auth)
        .send(registration)
        .expect(200);
      await request(app)
        .put(path)
        .set('Authorization', otherSession)
        .send(registration)
        .expect(429)
        .expect('Retry-After', /^\d+$/);
      await request(app)
        .delete(path)
        .set('Authorization', auth)
        .send({ transport })
        .expect(204);
    } finally {
      policy.identityLimit = original;
    }
  });

  it('recovers only fresh encrypted alerts for the registered session, pairing and author', async () => {
    const auth = await signIn();
    const otherSession = await signIn();
    const challenge = await request(app)
      .post(path + '/challenge')
      .set('Authorization', auth)
      .send(registration)
      .expect(200);
    await request(app)
      .put(path)
      .set('Authorization', auth)
      .send({
        ...registration,
        proof: finalizeEvent(challenge.body.event, secret),
      })
      .expect(204);

    const registered = await alertRegistrations()
      .findById(transport)
      .lean()
      .orFail();
    const timestamp = Math.floor(Date.now() / 1000);
    const unsigned = {
      kind: 24133,
      created_at: timestamp,
      tags: [['p', transport]],
      content: 'A'.repeat(132),
    };
    const expected = finalizeEvent({ ...unsigned }, authorSecret);
    const otherAuthor = finalizeEvent({ ...unsigned }, generateSecretKey());
    const expired = finalizeEvent(
      { ...unsigned, created_at: timestamp - 60 },
      authorSecret,
    );
    await mongoose.model('NostranslationAlertClaim').insertMany(
      [expected, otherAuthor, expired].map(event => ({
        _id: transport + ':' + event.id,
        user: registered.user,
        session: registered.session,
        transport,
        event,
        expiresAt: new Date((event.created_at + 60) * 1000),
      })),
    );

    const pending = (authorization: string, key = transport) =>
      request(app)
        .post(path + '/pending')
        .set('Authorization', authorization)
        .send({ transport: key });
    await request(app)
      .post(path + '/pending')
      .send({ transport })
      .expect(401);
    await pending(auth, 'invalid').expect(400);
    await pending(otherSession).expect(200, { events: [] });
    await pending(auth, getPublicKey(generateSecretKey())).expect(200, {
      events: [],
    });
    await pending(auth)
      .expect('Cache-Control', /no-store/)
      .expect(200, { events: [JSON.parse(JSON.stringify(expected))] });
    await request(app)
      .delete(path)
      .set('Authorization', auth)
      .send({ transport })
      .expect(204);
    await pending(auth).expect(200, { events: [] });
    config.featureFlags.nostranslationAlerts = false;
    await pending(auth).expect(404);
  });

  it('binds proof to the mobile session, transport key and device, then consumes it once', async () => {
    const auth = await signIn();
    const otherSession = await signIn();
    config.https = false;
    const challenge = await request(app)
      .post(path + '/challenge')
      .set('Authorization', auth)
      .send(registration)
      .expect(200);
    const digest = createHash('sha256')
      .update(`64:${author}64:${transport}3:ios64:${destination.token}`)
      .digest('hex');
    expect(challenge.body.event.tags).toEqual([
      ['u', 'http://' + config.domain + path],
      ['method', 'PUT'],
      ['challenge', expect.stringMatching(/^[a-f0-9]{64}$/)],
      ['payload', digest],
    ]);
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
    const challenges = mongoose.model('NostranslationAlertChallenge');
    const consume = vi.spyOn(challenges, 'findOneAndDelete');
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
    expect(consume).not.toHaveBeenCalled();
    const nonce = proof.tags.find(tag => tag[0] === 'challenge')![1];
    await challenges.updateOne(
      { _id: { $eq: nonce } },
      { $set: { expiresAt: new Date(0) } },
    );
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

  it.each([
    Object.assign(new Error('External failure with a reused error code.'), {
      code: 11000,
    }),
    new mongoose.mongo.MongoServerError({
      message: 'Database unavailable.',
      code: 91,
    }),
  ])(
    'returns a server error and consumes the proof after %s',
    async failure => {
      const auth = await signIn();
      const challenge = await request(app)
        .post(path + '/challenge')
        .set('Authorization', auth)
        .send(registration)
        .expect(200);
      const rows = mongoose.model('NostranslationAlertRegistration');
      vi.spyOn(rows, 'updateOne').mockRejectedValueOnce(failure);
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
    },
  );
});
