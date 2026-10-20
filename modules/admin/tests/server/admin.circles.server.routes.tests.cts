import type {
  Credentials,
  TestExpressApp,
  TestAgent,
  TribeRecord,
  TribeModel,
} from '../../../../testutils/server/model-contracts.mts';

const assert: typeof import('assert') = require('assert');
const request: typeof import('supertest') = require('supertest');
const mongoose: typeof import('mongoose') = require('mongoose');
const express: import('../../../../testutils/server/model-contracts.mts').TestExpressModule = require('../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');

const Tribe = mongoose.model<TribeRecord, TribeModel>('Tribe');
type CircleResponse = Omit<TribeRecord, 'created' | 'modified'> & {
  _id: string;
  created?: string;
  modified?: string;
};

describe('Admin circle routes', () => {
  let app: TestExpressApp;
  let agent: TestAgent;
  let credentials: Credentials;

  before(async () => {
    app = await express.init(mongoose.connection);
  });

  beforeEach(async () => {
    agent = request.agent(app);
    const users = utils.generateUsersWithSharedPassword(1);
    users[0].roles = ['user', 'admin'];
    credentials = { username: users[0].username, password: users[0].password };
    await utils.saveUsersWithCachedPasswords(users);
  });

  afterEach(utils.clearDatabase);

  it('creates and edits JSON metadata with blank optional fields', async () => {
    await utils.signIn(credentials, agent);
    const { body: created }: { body: CircleResponse } = await agent
      .post('/api/admin/circles')
      .send({
        label: 'Example walkers',
        color: '345d5c',
        public: false,
        attribution: '',
        attribution_url: '',
        description: '',
      })
      .expect(201);
    assert.strictEqual(created.image, false);
    assert.strictEqual(created.public, false);
    await agent.get(`/api/admin/circles/${created._id}`).expect(200);
    const { body: catalogue }: { body: CircleResponse[] } = await agent
      .get('/api/admin/circles')
      .expect(200);
    assert(
      catalogue.some(circle => String(circle._id) === String(created._id)),
    );
    const { body: updated }: { body: CircleResponse } = await agent
      .put(`/api/admin/circles/${created._id}`)
      .send({
        label: 'Example walkers renamed',
        color: 'e74c3c',
        public: true,
        attribution: 'Example artist',
        attribution_url: 'https://example.org/artist',
        description: 'An updated circle.',
      })
      .expect(200);
    assert.strictEqual(updated.slug, created.slug);
    assert.strictEqual(updated.label, 'Example walkers renamed');
    assert.strictEqual(updated.public, true);
    assert.strictEqual(updated.color, 'e74c3c');
    assert.strictEqual(updated.attribution, 'Example artist');
    assert.strictEqual(updated.description, 'An updated circle.');
    const { body: cleared }: { body: CircleResponse } = await agent
      .put(`/api/admin/circles/${created._id}`)
      .send({
        label: 'Example walkers renamed',
        color: 'e74c3c',
        public: true,
        attribution: '',
        attribution_url: '   ',
        description: 'An updated circle.',
      })
      .expect(200);
    assert.strictEqual(cleared.attribution, undefined);
    assert.strictEqual(cleared.attribution_url, undefined);
    const stored = await Tribe.findById(created._id);
    assert(stored);
    assert.strictEqual(stored.attribution, undefined);
    assert.strictEqual(stored.attribution_url, undefined);
    assert.strictEqual(stored.description, updated.description);
    await agent
      .post('/api/admin/circles')
      .send({ label: 'Bad colour', color: 'zzzzzz' })
      .expect(400);
    await agent
      .post('/api/admin/circles')
      .send({
        label: 'Bright circle',
        color: '2ecc71',
        description: 'x'.repeat(4001),
      })
      .expect(400);
    const { body: bright }: { body: CircleResponse } = await agent
      .post('/api/admin/circles')
      .send({
        label: 'Bright circle',
        color: '2ecc71',
        description: 'Plant-based travellers.',
      })
      .expect(201);
    assert.strictEqual(bright.color, '2ecc71');
  });

  it('denies a signed-in member', async () => {
    const members = utils.generateUsersWithSharedPassword(1);
    members[0].roles = ['user'];
    await utils.saveUsersWithCachedPasswords(members);
    await utils.signIn(
      { username: members[0].username, password: members[0].password },
      agent,
    );
    const id = new mongoose.Types.ObjectId();
    await agent.get('/api/admin/circles').expect(403);
    await agent.get(`/api/admin/circles/${id}`).expect(403);
    await agent
      .post('/api/admin/circles')
      .send({ label: 'Example walkers' })
      .expect(403);
    await agent
      .put(`/api/admin/circles/${id}`)
      .send({ label: 'Example walkers' })
      .expect(403);
  });

  it('denies unauthenticated catalogue reads and writes', async () => {
    const id = new mongoose.Types.ObjectId();
    await agent.get('/api/admin/circles').expect(403);
    await agent.get(`/api/admin/circles/${id}`).expect(403);
    await agent
      .post('/api/admin/circles')
      .send({ label: 'Example walkers' })
      .expect(403);
    await agent
      .put(`/api/admin/circles/${id}`)
      .send({ label: 'Example walkers' })
      .expect(403);
  });
});
