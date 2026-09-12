const assert = require('assert');
const request = require('supertest');
const mongoose = require('mongoose');
const express = require('../../../../config/lib/express');
const utils = require('../../../../testutils/server/data.server.testutil');

const Tribe = mongoose.model('Tribe');

describe('Admin circle routes', () => {
  const app = express.init(mongoose.connection);
  let agent;
  let credentials;

  beforeEach(async () => {
    agent = request.agent(app);
    const users = utils.generateUsers(1);
    users[0].roles = ['user', 'admin'];
    credentials = { username: users[0].username, password: users[0].password };
    await utils.saveUsers(users);
  });

  afterEach(utils.clearDatabase);

  it('creates and edits JSON metadata with blank optional fields', async () => {
    await utils.signIn(credentials, agent);
    const { body: created } = await agent
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
    const { body: catalogue } = await agent
      .get('/api/admin/circles')
      .expect(200);
    assert(catalogue.some(circle => circle._id === created._id));
    const { body: updated } = await agent
      .put(`/api/admin/circles/${created._id}`)
      .send({
        label: 'Example walkers',
        color: '345d5c',
        public: true,
        attribution: '',
        attribution_url: '',
        description: 'An updated circle.',
      })
      .expect(200);
    assert.strictEqual(updated.slug, created.slug);
    assert.strictEqual(updated.public, true);
    assert.strictEqual(updated.description, 'An updated circle.');
    const stored = await Tribe.findById(created._id);
    assert.strictEqual(stored.description, updated.description);
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
