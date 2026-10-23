/** @jest-environment node */
import request from 'supertest';
import { finalizeEvent, generateSecretKey } from 'nostr-tools';
import { createApp } from '../server/app.mts';
import { catalogue, digest } from '../server/catalogue.mts';
import { Store } from '../server/store.mts';
import { Problem, ReviewService } from '../server/service.mts';
import type { Repository } from '../server/github.mts';
import { snapshot } from './fixtures.ts';

const config = {
  publicURL: 'https://translation-api.example',
  origin: 'https://team.trustroots.org',
};
const key = generateSecretKey();
function sign(body: string) {
  const event = finalizeEvent(
    {
      kind: 27235,
      content: '',
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['u', config.publicURL + '/api/reviews'],
        ['method', 'POST'],
        ['payload', digest(body)],
      ],
    },
    key,
  );
  return 'Nostr ' + Buffer.from(JSON.stringify(event)).toString('base64');
}

describe('review API', () => {
  let store: Store;
  beforeEach(() => {
    store = new Store(':memory:');
  });
  afterEach(() => {
    store.close();
  });
  function setup() {
    const repository = {
      languages: jest.fn(async () => snapshot().languages),
      load: jest.fn(async () => snapshot()),
    };
    const submit = jest.fn(
      async () => 'https://github.com/Trustroots/trustroots/pull/99999',
    );
    const app = createApp(config, repository as unknown as Repository, store, {
      submit,
    } as unknown as ReviewService);
    return { app, submit, repository };
  }

  it('can load a catalogue before a separate language-list request', async () => {
    const { app, repository } = setup();
    await request(app).get('/api/catalogue?locale=de').expect(200);
    expect(repository.languages).toHaveBeenCalledTimes(1);
  });

  it('serves cached catalogue reads with only current drafts and explicit CORS', async () => {
    const { app, repository } = setup();
    await request(app).get('/health').expect(200, { status: 'ok' });
    await request(app)
      .options('/api/reviews')
      .set('Origin', config.origin)
      .expect('Access-Control-Allow-Origin', config.origin)
      .expect(204);
    const outsider = await request(app)
      .get('/health')
      .set('Origin', 'https://other.example');
    expect(outsider.headers['access-control-allow-origin']).toBeUndefined();
    await request(app).get('/api/languages').expect(200);
    await request(app).get('/api/catalogue?locale=de').expect(200);
    const entry = catalogue('de', snapshot()).entries[0];
    store.saveDraft('de', entry, 'Hallo {{name}}', 'test-model', 'revision');
    const current = await request(app)
      .get('/api/catalogue?locale=de')
      .expect(200);
    expect(current.body.entries[0].suggestion).toBe('Hallo {{name}}');
    expect(repository.load).toHaveBeenCalledTimes(1);
    await request(app).get('/api/catalogue?locale=../x').expect(400);
    await request(app).get('/api/catalogue').expect(400);
    await request(app).get('/api/catalogue?locale[]=de').expect(400);
  });

  it('coalesces in-flight reads, refreshes expired cache and retries failed reads', async () => {
    const { app, repository } = setup();
    let finish: (
      value: ReturnType<typeof snapshot>['languages'],
    ) => void = () => {};
    repository.languages.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const first = request(app)
      .get('/api/languages')
      .then(result => result);
    const second = request(app)
      .get('/api/languages')
      .then(result => result);
    await new Promise(resolve => setTimeout(resolve, 20));
    finish(snapshot().languages);
    expect((await first).status).toBe(200);
    expect((await second).status).toBe(200);
    expect(repository.languages).toHaveBeenCalledTimes(1);
    const time = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);
    await request(app).get('/api/languages').expect(200);
    expect(repository.languages).toHaveBeenCalledTimes(2);
    time.mockRestore();
    repository.load.mockRejectedValueOnce(new Error('offline'));
    await request(app).get('/api/catalogue?locale=ar').expect(503);
    await request(app).get('/api/catalogue?locale=ar').expect(200);
  });

  it('requires body-bound signatures, rejects replays and returns PR links', async () => {
    const { app, submit } = setup();
    const entry = catalogue('de', snapshot()).entries[0];
    const body = JSON.stringify({
      username: 'fictional',
      locale: 'de',
      changes: [
        {
          id: entry.id,
          sourceHash: entry.sourceHash,
          original: null,
          value: 'Hallo {{name}}',
        },
      ],
    });
    await request(app).post('/api/reviews').send({}).expect(401);
    await request(app)
      .post('/api/reviews')
      .set('Content-Type', 'text/plain')
      .send('x')
      .expect(400);
    const auth = sign(body);
    await request(app)
      .post('/api/reviews')
      .set('Content-Type', 'application/json')
      .set('Authorization', auth)
      .send(body)
      .expect(200, {
        url: 'https://github.com/Trustroots/trustroots/pull/99999',
      });
    await request(app)
      .post('/api/reviews')
      .set('Content-Type', 'application/json')
      .set('Authorization', auth)
      .send(body)
      .expect(401);
    expect(submit).toHaveBeenCalledTimes(1);
    const invalid = '{broken';
    await request(app)
      .post('/api/reviews')
      .set('Content-Type', 'application/json')
      .set('Authorization', sign(invalid))
      .send(invalid)
      .expect(400);
    const bad = '{}';
    await request(app)
      .post('/api/reviews')
      .set('Content-Type', 'application/json')
      .set('Authorization', sign(bad))
      .send(bad)
      .expect(400);
    const retry = body.replace('Hallo', 'Willkommen');
    submit.mockRejectedValueOnce(new Problem(403, 'Identity mismatch.'));
    await request(app)
      .post('/api/reviews')
      .set('Content-Type', 'application/json')
      .set('Authorization', sign(retry))
      .send(retry)
      .expect(403, { error: 'Identity mismatch.' });
    await request(app)
      .post('/api/reviews')
      .set('Content-Type', 'application/json')
      .send('x'.repeat(1100000))
      .expect(413);
  });

  it('constructs the normal review service when no override is supplied', async () => {
    const repository = { languages: async () => [] } as unknown as Repository;
    await request(createApp(config, repository, store))
      .get('/api/languages')
      .expect(200, []);
  });
});
