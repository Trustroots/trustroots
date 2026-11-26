import assert from 'node:assert/strict';
import express, { type Request, type Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import request from 'supertest';
import { vi } from 'vitest';
import authenticationService from '../../../users/server/services/authentication.server.service.mts';
import mockModule from './../../../../testutils/server/mock-module.mts';
import type { CoreRouteDependencies } from '../../server/routes/core.server.routes.mts';

type TribeRequest = Request & { tribe?: { slug: string }; user?: unknown };
const TEST_LOOKUP_LIMIT = 2;

/** Mount the core routes on a bare app, with controllers that name themselves. */
async function app(
  signedIn = false,
  overrides: Partial<CoreRouteDependencies> = {},
) {
  const { default: routes } = await mockModule<
    typeof import('../../server/routes/core.server.routes.mts')
  >(new URL('../../server/routes/core.server.routes.mts', import.meta.url), {
    './../controllers/core.server.controller.mts': {
      renderIndex(_sanitize: unknown, req: TribeRequest, res: Response) {
        res.send(`index:${req.tribe?.slug ?? ''}`);
      },
      renderNotFound(_sanitize: unknown, _req: Request, res: Response) {
        res.status(404).send('not-found');
      },
      receiveCSPViolationReport(_req: Request, res: Response) {
        res.status(204).end();
      },
      getLanguages(_req: Request, res: Response) {
        res.send('languages');
      },
    },
    'express-rate-limit': {
      ipKeyGenerator,
      rateLimit: (options: Parameters<typeof rateLimit>[0]) =>
        rateLimit({ ...options, limit: TEST_LOOKUP_LIMIT }),
    },
  });
  const server = express();
  server.use((req, _res, next) => {
    if (signedIn) Object.assign(req, { user: { _id: 'fictional-member' } });
    next();
  });
  // Simulate the app-wide lookup supplied by the Tribes routes.
  server.param('tribe', (req: TribeRequest, _res, next, slug: string) => {
    req.tribe = { slug };
    next();
  });
  routes(server, {
    sanitizeOwnProfile: user => user,
    isLegacyUsernameLookupValid:
      authenticationService.isLegacyUsernameLookupValid,
    findNostrUsers: async () => [],
    findNip05User: async () => null,
    findPublicNip05Usernames: async () => new Map(),
    ...overrides,
  });
  return server;
}

describe('Core route table', function () {
  it('permanently redirects retired paths', async function () {
    const server = await app();
    for (const [from, to] of [
      ['/invite', '/signup'],
      ['/tribes/lgbt', '/circles/lgbtq'],
      ['/tribes/vegans-vegetarians', '/circles/veg'],
      ['/faq/tribes', '/faq/circles'],
      ['/tribes', '/circles'],
      ['/tribes/hikers', '/circles/hikers'],
    ]) {
      const response = await request(server).get(from).expect(301);
      assert.equal(response.headers.location, to, from);
    }
  });

  it('accepts CSP violation reports', async function () {
    await request(await app())
      .post('/api/report-csp-violation')
      .expect(204);
  });

  it('validates Nostr author visibility requests', async function () {
    const response = await request(await app())
      .get('/api/nostr/author-visibility?pubkey=invalid')
      .expect(400);
    assert.deepEqual(response.body, {
      error: 'One to 100 valid public keys required.',
    });
  });

  it('validates NIP-05 lookups', async function () {
    const response = await request(await app())
      .get('/.well-known/nostr.json')
      .expect(400);
    assert.deepEqual(response.body, { error: 'Valid username required.' });
    assert.equal(response.headers['access-control-allow-origin'], '*');
  });

  it('uses the injected Nostr lookups and keeps visibility and cache policy', async function () {
    const visibleKey = getPublicKey(generateSecretKey());
    const privateKey = getPublicKey(generateSecretKey());
    const visibleNpub = nip19.npubEncode(visibleKey);
    let usernameLookup = '';
    const server = await app(true, {
      findNostrUsers: async npubs => {
        assert.deepEqual(npubs, [visibleNpub, nip19.npubEncode(privateKey)]);
        return [
          {
            username: 'fictionalpublic',
            nostrNpub: visibleNpub,
            public: true,
            email: 'public@example.test',
            roles: ['user'],
          },
          {
            username: 'fictionalprivate',
            nostrNpub: nip19.npubEncode(privateKey),
            public: false,
            email: 'private@example.test',
            roles: ['user'],
          },
        ];
      },
      findNip05User: async username => {
        usernameLookup = username;
        return {
          username,
          nostrNpub: visibleNpub,
          public: true,
          email: 'public@example.test',
          roles: ['user'],
        };
      },
    });

    await request(server)
      .get(
        `/api/nostr/author-visibility?profiles=1&pubkey=${visibleKey}&pubkey=${privateKey}`,
      )
      .expect('Cache-Control', 'private, no-store')
      .expect(200, {
        linkedPubkeys: [visibleKey, privateKey],
        pubkeys: [visibleKey],
        usernames: { [visibleKey]: 'fictionalpublic' },
      });
    await request(server)
      .get('/.well-known/nostr.json?name=FictionalPublic')
      .expect(200, { names: { fictionalpublic: visibleKey } });
    assert.equal(usernameLookup, 'fictionalpublic');
  });

  it('serves the service identity without looking up a member', async function () {
    const current = generateSecretKey();
    const legacy = generateSecretKey();
    const client = request(await app());
    let address = 0;
    const lookup = () =>
      client
        .get('/.well-known/nostr.json?name=_')
        .set('!~Passenger-Client-Address', `2001:db8:${++address}::1`);
    vi.stubEnv('TRUSTROOTS_NOSTR_EXPORT_NSEC', nip19.nsecEncode(legacy));
    vi.stubEnv('TRUSTROOTS_NOSTR_SERVICE_NSEC', nip19.nsecEncode(current));
    try {
      await lookup().expect(200, { names: { _: getPublicKey(current) } });
      vi.stubEnv('TRUSTROOTS_NOSTR_SERVICE_NSEC', undefined);
      await lookup().expect(200, { names: { _: getPublicKey(legacy) } });
      vi.stubEnv(
        'TRUSTROOTS_NOSTR_SERVICE_NSEC',
        nip19.npubEncode(getPublicKey(current)),
      );
      await lookup().expect(200, { names: {} });
      vi.stubEnv('TRUSTROOTS_NOSTR_SERVICE_NSEC', 'invalid');
      await lookup().expect(200, { names: {} });
      vi.stubEnv('TRUSTROOTS_NOSTR_SERVICE_NSEC', undefined);
      vi.stubEnv('TRUSTROOTS_NOSTR_EXPORT_NSEC', undefined);
      await lookup().expect(200, { names: {} });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('limits each public Nostr lookup independently and retains response headers', async function () {
    const server = await app();
    const client = request(server);
    const header = '!~Passenger-Client-Address';
    const address = '2001:db8:2::1';
    const authorVisibility = '/api/nostr/author-visibility?profiles=1';
    const nip05 = '/.well-known/nostr.json';
    for (let count = 0; count < TEST_LOOKUP_LIMIT; count += 1) {
      await client.get(authorVisibility).set(header, address).expect(400);
    }
    await client
      .get(authorVisibility)
      .set(header, '2001:db8:2::2')
      .expect(429)
      .expect('Retry-After', /^\d+$/)
      .expect('Cache-Control', 'private, no-store');
    await client.get(authorVisibility).set(header, '2001:db8:3::1').expect(400);

    for (let count = 0; count < TEST_LOOKUP_LIMIT; count += 1) {
      await client.get(nip05).set(header, address).expect(400);
    }
    await client
      .get(nip05)
      .set(header, address)
      .expect(429)
      .expect('Retry-After', /^\d+$/)
      .expect('Access-Control-Allow-Origin', '*');

    Object.defineProperty(server.request, 'ip', { value: undefined });
    await client.get(nip05).expect(400);
  });

  it('answers unknown API, module, lib and developer paths with not found', async function () {
    const server = await app();
    for (const path of [
      '/api/unknown',
      '/API/unknown/deeper',
      '/modules/core/x.js',
      '/lib/x.js',
      '/developers/',
    ]) {
      const response = await request(server).get(path).expect(404);
      assert.equal(response.text, 'not-found', path);
    }
    const page = await request(server).get('/profile/api/unknown').expect(200);
    assert.equal(page.text, 'index:');
  });

  it('sends visitors of the Naturists circle to sign in', async function () {
    const response = await request(await app())
      .get('/circles/naturists')
      .expect(302);
    assert.equal(response.headers.location, '/signin');
    const member = await request(await app(true))
      .get('/circles/naturists')
      .expect(200);
    assert.equal(member.text, 'index:naturists');
  });

  it('renders circle pages with their circle and every other page with the app', async function () {
    const circle = await request(await app())
      .get('/circles/hikers')
      .expect(200);
    assert.equal(circle.text, 'index:hikers');
    const page = await request(await app())
      .get('/search/members')
      .expect(200);
    assert.equal(page.text, 'index:');
  });
});
