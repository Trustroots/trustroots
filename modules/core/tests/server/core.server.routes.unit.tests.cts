import type { NextFunction, Request, Response } from 'express';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const express: typeof import('express') = require('express');
const request: typeof import('supertest') = require('supertest');
const mockModule: typeof import('../../../../testutils/server/mock-module') = require('../../../../testutils/server/mock-module');

type TribeRequest = Request & { tribe?: { slug: string }; user?: unknown };

/** Mount the core routes on a bare app, with controllers that name themselves. */
function app(signedIn = false) {
  const routes = mockModule<(app: import('express').Application) => void>(
    require.resolve('../../server/routes/core.server.routes.mts'),
    {
      './../controllers/core.server.controller.mjs': {
        renderIndex(req: TribeRequest, res: Response) {
          res.send(`index:${req.tribe?.slug ?? ''}`);
        },
        renderNotFound(_req: Request, res: Response) {
          res.status(404).send('not-found');
        },
        receiveCSPViolationReport(_req: Request, res: Response) {
          res.status(204).end();
        },
        getLanguages(_req: Request, res: Response) {
          res.send('languages');
        },
      },
      './../../../tribes/server/controllers/tribes.server.controller.mjs': {
        tribeBySlug(
          req: TribeRequest,
          _res: Response,
          next: NextFunction,
          slug: string,
        ) {
          req.tribe = { slug };
          next();
        },
      },
    },
  );
  const server = express();
  server.use((req, _res, next) => {
    if (signedIn) Object.assign(req, { user: { _id: 'fictional-member' } });
    next();
  });
  routes(server);
  return server;
}

describe('Core route table', function () {
  it('permanently redirects retired paths', async function () {
    const server = app();
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
    await request(app()).post('/api/report-csp-violation').expect(204);
  });

  it('validates Nostr author visibility requests', async function () {
    const response = await request(app())
      .get('/api/nostr/author-visibility?pubkey=invalid')
      .expect(400);
    assert.deepEqual(response.body, {
      error: 'One to 100 valid public keys required.',
    });
  });

  it('validates NIP-05 lookups', async function () {
    const response = await request(app())
      .get('/.well-known/nostr.json')
      .expect(400);
    assert.deepEqual(response.body, { error: 'Valid username required.' });
    assert.equal(response.headers['access-control-allow-origin'], '*');
  });

  it('answers unknown API, module, lib and developer paths with not found', async function () {
    const server = app();
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
    const response = await request(app()).get('/circles/naturists').expect(302);
    assert.equal(response.headers.location, '/signin');
    const member = await request(app(true))
      .get('/circles/naturists')
      .expect(200);
    assert.equal(member.text, 'index:naturists');
  });

  it('renders circle pages with their circle and every other page with the app', async function () {
    const circle = await request(app()).get('/circles/hikers').expect(200);
    assert.equal(circle.text, 'index:hikers');
    const page = await request(app()).get('/search/members').expect(200);
    assert.equal(page.text, 'index:');
  });
});
