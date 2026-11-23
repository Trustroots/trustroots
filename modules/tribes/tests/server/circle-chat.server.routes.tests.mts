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

function chatApp(account?: { nostrNpub?: string; roles?: string[] }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (account) {
      Object.assign(req, {
        user: {
          _id: 'fictional-account',
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

describe('Circle chat API', () => {
  const path = '/api/tribes/chat/hitchhikers';

  it('rejects guest access and prevents caches from storing a response', async () => {
    const app = chatApp();
    await app
      .get(path)
      .expect('Cache-Control', 'private, no-store')
      .expect(401);
    await app.post(path).send({ content: 'Fictional chat' }).expect(401);
  });

  it('rejects accounts restricted from messaging', async () => {
    await chatApp({ roles: ['user', 'shadowban'] })
      .get(path)
      .expect(403);
    await chatApp({ roles: ['user', 'suspended'] })
      .post(path)
      .expect(403);
  });

  it('accepts only the four registered room names', async () => {
    await chatApp({}).get('/api/tribes/chat/constructor').expect(404);
  });

  it('requires linked members to use their own signers', async () => {
    const nostrNpub = nip19.npubEncode(getPublicKey(generateSecretKey()));
    await chatApp({ nostrNpub })
      .post(path)
      .send({ content: 'Fictional chat' })
      .expect(403);
  });

  it('validates message length and Radio station tags before signing', async () => {
    const app = chatApp({});
    await app.post(path).send({ content: '  ' }).expect(400);
    await app
      .post(path)
      .send({ content: 'x'.repeat(501) })
      .expect(400);
    await app
      .post(path)
      .send({ content: 'Fictional chat', channel: 'groovesalad' })
      .expect(400);
    await app
      .post('/api/tribes/chat/radio')
      .send({ content: 'Fictional chat', channel: '/bad' })
      .expect(400);
  });

  it('authenticates with the export key, publishes session attribution and reads the same room', async () => {
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
          for (const event of events) this.receive(['EVENT', frame[1], event]);
          this.receive(['EOSE', frame[1]]);
        }
      }
      close() {}
    }

    vi.stubEnv('TRUSTROOTS_NOSTR_EXPORT_NSEC', nip19.nsecEncode(serviceKey));
    useWebSocketImplementation(RelaySocket);
    try {
      const app = chatApp({});
      const radioPath = '/api/tribes/chat/radio';
      const sent = await app
        .post(radioPath)
        .send({
          content: '  Fictional server-signed post  ',
          channel: 'groovesalad',
          username: 'spoofed-member',
        })
        .expect(201);
      assert.equal(sent.body.pubkey, servicePubkey);
      assert.equal(sent.body.content, 'Fictional server-signed post');
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
      assert.deepEqual(
        connections,
        Array(2).fill('wss://nip42.trustroots.org/'),
      );
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
    } finally {
      useWebSocketImplementation(globalThis.WebSocket);
      vi.unstubAllEnvs();
    }
  });

  it('returns a service error when the export signing key is unavailable', async () => {
    const previous = process.env.TRUSTROOTS_NOSTR_EXPORT_NSEC;
    delete process.env.TRUSTROOTS_NOSTR_EXPORT_NSEC;
    try {
      const app = chatApp({});
      const result = await app.get(path).expect(503);
      assert.equal(
        result.body.message,
        'Circle chat is temporarily unavailable.',
      );
      await app.post(path).send({ content: 'Fictional chat' }).expect(503);
    } finally {
      if (previous !== undefined)
        process.env.TRUSTROOTS_NOSTR_EXPORT_NSEC = previous;
    }
  });
});
