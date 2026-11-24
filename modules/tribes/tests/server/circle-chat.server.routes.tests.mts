import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip19,
  verifyEvent,
  type Event,
} from 'nostr-tools';
import { useWebSocketImplementation } from 'nostr-tools/relay';
import { vi } from 'vitest';
import { registerCircleChat } from '../../server/controllers/circle-chat.server.controller.mts';
import { readCircleChat } from '../../server/services/circle-chat.server.mts';

let nextAccountId = 0;

function chatApp(account?: { nostrNpub?: string; roles?: string[] }) {
  const app = express();
  const accountId = `fictional-account-${++nextAccountId}`;
  app.use(express.json());
  app.use((req, _res, next) => {
    if (account) {
      Object.assign(req, {
        user: {
          _id: req.get('X-Test-Account-Id') ?? accountId,
          username: 'fictional-member',
          roles: ['user'],
          ...account,
        },
      });
    }
    next();
  });
  registerCircleChat(app);
  return request(app);
}

function fakeRelay(events: Event[], closeReason?: string) {
  const authenticated: Event[] = [];
  const published: Event[] = [];
  const connections: string[] = [];

  class RelaySocket {
    onopen?: () => void;
    onmessage?: (event: MessageEvent) => void;
    readyState = 1;
    constructor(url: string) {
      connections.push(url);
      queueMicrotask(() => {
        this.onopen?.();
        this.receive(['AUTH', 'fictional-relay-challenge']);
      });
    }
    private receive(frame: unknown[]) {
      this.onmessage?.(
        new MessageEvent('message', { data: JSON.stringify(frame) }),
      );
    }
    send(payload: string) {
      const frame = JSON.parse(payload);
      if (frame[0] === 'AUTH') {
        authenticated.push(frame[1]);
        this.receive(['OK', frame[1].id, true, '']);
      }
      if (frame[0] === 'EVENT') {
        published.push(frame[1]);
        events.push(frame[1]);
        this.receive(['OK', frame[1].id, true, '']);
      }
      if (frame[0] === 'REQ') {
        if (closeReason) {
          this.receive(['CLOSED', frame[1], closeReason]);
          return;
        }
        for (const event of events) this.receive(['EVENT', frame[1], event]);
        this.receive(['EOSE', frame[1]]);
      }
    }
    close() {}
  }

  useWebSocketImplementation(RelaySocket);
  return { authenticated, published, connections };
}

afterEach(() => {
  useWebSocketImplementation(globalThis.WebSocket);
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Circle chat API', () => {
  const path = '/api/tribes/chat/hitchhikers';

  beforeEach(() => {
    vi.stubEnv('TRUSTROOTS_NOSTR_SERVICE_NSEC', undefined);
    vi.stubEnv('TRUSTROOTS_NOSTR_EXPORT_NSEC', undefined);
  });

  it('rejects guest access and prevents caches from storing a response', async () => {
    const app = chatApp();
    await app
      .get(path)
      .expect('Cache-Control', 'private, no-store')
      .expect(401, { message: 'Sign in to use circle chat.' });
    await app.post(path).send({ content: 'Fictional chat' }).expect(401);
  });

  it('rejects accounts restricted from messaging', async () => {
    await chatApp({ roles: ['user', 'shadowban'] })
      .get(path)
      .expect(403, { message: 'Circle chat is unavailable for this account.' });
    await chatApp({ roles: ['user', 'suspended'] })
      .post(path)
      .expect(403);
  });

  it('accepts only the four registered room names', async () => {
    await chatApp({})
      .get('/api/tribes/chat/constructor')
      .expect(404, { message: 'Chat room not found.' });
  });

  it('requires linked members to use their own signers', async () => {
    const nostrNpub = nip19.npubEncode(getPublicKey(generateSecretKey()));
    await chatApp({ nostrNpub })
      .post(path)
      .send({ content: 'Fictional chat' })
      .expect(403, {
        message: 'Use the signer linked to your Trustroots account.',
      });
  });

  it('validates message length and Radio station tags before signing', async () => {
    const app = chatApp({});
    const invalidMessage = {
      message: 'Enter a chat message of up to 500 characters.',
    };
    const invalidStation = { message: 'Invalid radio station.' };
    await app.post(path).expect(400, invalidMessage);
    for (const content of ['  ', 123, 'x'.repeat(501)]) {
      await app.post(path).send({ content }).expect(400, invalidMessage);
    }
    await app
      .post(path)
      .send({ content: 'Fictional chat', channel: 'groovesalad' })
      .expect(400, invalidStation);
    for (const channel of ['station/bad', ['groovesalad']]) {
      await app
        .post('/api/tribes/chat/radio')
        .send({ content: 'Fictional chat', channel })
        .expect(400, invalidStation);
    }
  });

  it('rate-limits posts per account and keeps GET requests available', async () => {
    const app = chatApp({});
    for (let index = 0; index < 12; index += 1) {
      await app.post(path).expect(400);
    }
    await app
      .post(path)
      .expect('RateLimit', /r=0/)
      .expect(res => assert.equal(res.headers['x-ratelimit-limit'], undefined))
      .expect(429, {
        message: 'Too many chat messages. Please try again shortly.',
      });
    await app
      .post(path)
      .set('X-Test-Account-Id', 'another-fictional-account')
      .expect(400);
    await app.get(path).expect(503);
  });

  it('authenticates with the service key, publishes session attribution and reads the same room', async () => {
    const serviceKey = generateSecretKey();
    const servicePubkey = getPublicKey(serviceKey);
    const memberKey = generateSecretKey();
    const now = Math.floor(Date.now() / 1000);
    const makeEvent = (content: string, tags: string[][], created_at = now) =>
      finalizeEvent({ kind: 1, content, tags, created_at }, memberKey);
    const topic = ['t', 'radiostr'];
    const memberMessage = makeEvent('Message from a fictional signer', [topic]);
    const events = [
      memberMessage,
      makeEvent('Different room', [['t', 'other']]),
      makeEvent('Listening activity', [topic, ['t', 'nowplaying']]),
      makeEvent('Expired message', [topic, ['expiration', '1']]),
      makeEvent('Future message', [topic], now + 360),
      makeEvent('Invalid timestamp', [topic], -1),
    ];
    const { authenticated, published, connections } = fakeRelay(events);
    vi.stubEnv('TRUSTROOTS_NOSTR_SERVICE_NSEC', nip19.nsecEncode(serviceKey));
    const app = chatApp({});
    const radioPath = '/api/tribes/chat/radio';
    const longestMessage = 'Fictional '.repeat(49) + 'chat post.';
    const sent = await app
      .post(radioPath)
      .send({
        content: `  ${longestMessage}  `,
        channel: 'groovesalad',
        username: 'spoofed-member',
      })
      .expect(201);
    assert.equal(sent.body.pubkey, servicePubkey);
    assert.equal(sent.body.content, longestMessage);
    assert.ok(
      sent.body.tags.some(
        (tag: string[]) =>
          tag[0] === 'trustroots_username' && tag[1] === 'fictional-member',
      ),
    );
    assert.ok(
      sent.body.tags.some(
        (tag: string[]) => tag[0] === 'channel' && tag[1] === 'groovesalad',
      ),
    );
    assert.ok(verifyEvent(sent.body));
    assert.deepEqual(
      published.map(event => event.id),
      [sent.body.id],
    );

    const history = await app.get(radioPath).expect(200);
    assert.equal(history.body.servicePubkey, servicePubkey);
    assert.deepEqual(
      history.body.messages.map((event: Event) => event.id),
      [memberMessage.id, sent.body.id],
    );
    assert.deepEqual(connections, Array(2).fill('wss://nip42.trustroots.org/'));
    assert.equal(authenticated.length, 2);
    for (const event of authenticated) {
      assert.equal(event.kind, 22242);
      assert.equal(event.pubkey, servicePubkey);
      assert.ok(
        event.tags.some(
          ([name, value]) =>
            name === 'challenge' && value === 'fictional-relay-challenge',
        ),
      );
      assert.ok(verifyEvent(event));
    }
  });

  it('checks history timestamp boundaries, expiration and Radio activity', async () => {
    const secret = generateSecretKey();
    vi.stubEnv('TRUSTROOTS_NOSTR_EXPORT_NSEC', nip19.nsecEncode(secret));
    const now = Math.floor(Date.now() / 1000);
    vi.spyOn(Date, 'now').mockReturnValue(now * 1000);
    const makeEvent = (
      content: string,
      created_at = now,
      tags: string[][] = [],
    ) =>
      finalizeEvent(
        {
          kind: 1,
          content,
          created_at,
          tags: [['t', 'radiostr'], ...tags],
        },
        secret,
      );
    const accepted = [
      makeEvent('Epoch', 0),
      makeEvent('Tolerance', now + 60),
      makeEvent('Other tag', now, [['example', 'favorite']]),
      makeEvent('Not expired', now, [['expiration', String(now + 1)]]),
    ];
    fakeRelay([
      ...accepted,
      makeEvent('Expired', now, [['expiration', String(now)]]),
      makeEvent('Favourite', now, [['t', 'favorite']]),
      makeEvent('Now playing', now, [['t', 'nowplaying']]),
      makeEvent('Too far ahead', now + 61),
      makeEvent('Before epoch', -1),
      makeEvent('Fractional', now + 0.5),
    ]);
    const result = await readCircleChat('radio');
    assert.deepEqual(
      result.messages.map(event => event.id),
      accepted.map(event => event.id),
    );
  });

  it('caps history at 200 unique events and keeps other rooms’ chat', async () => {
    const secret = generateSecretKey();
    vi.stubEnv('TRUSTROOTS_NOSTR_EXPORT_NSEC', nip19.nsecEncode(secret));
    const created_at = Math.floor(Date.now() / 1000);
    const makeEvent = (content: string) =>
      finalizeEvent(
        {
          kind: 1,
          content,
          created_at,
          tags: [
            ['t', 'trustroots-circle-hackers'],
            ['t', 'favorite'],
          ],
        },
        secret,
      );
    const accepted = Array.from({ length: 200 }, (_, index) =>
      makeEvent(String(index)),
    );
    fakeRelay([accepted[0]!, ...accepted, makeEvent('Overflow')]);
    const result = await readCircleChat('hackers');
    assert.deepEqual(
      result.messages.map(event => event.id),
      accepted.map(event => event.id),
    );
  });

  it('rejects an incomplete history when the relay closes', async () => {
    vi.stubEnv(
      'TRUSTROOTS_NOSTR_EXPORT_NSEC',
      nip19.nsecEncode(generateSecretKey()),
    );
    fakeRelay([], 'Relay closed the subscription');
    await assert.rejects(readCircleChat('radio'), {
      message: 'Relay closed the subscription',
    });
  });

  it('requires a configured secret key', async () => {
    const publicKey = nip19.npubEncode(getPublicKey(generateSecretKey()));
    for (const encoded of ['', publicKey]) {
      vi.stubEnv('TRUSTROOTS_NOSTR_EXPORT_NSEC', encoded);
      await assert.rejects(readCircleChat('radio'), {
        message: 'Circle chat signer is unavailable',
      });
    }
  });

  it('returns a service error when the signing key is unavailable', async () => {
    const app = chatApp({});
    await app.get(path).expect(503, {
      message: 'Circle chat is temporarily unavailable.',
    });
    await app.post(path).send({ content: 'Fictional chat' }).expect(503, {
      message: 'Circle chat is temporarily unavailable.',
    });
  });
});
