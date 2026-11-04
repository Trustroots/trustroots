const request = require('supertest');
const mongoose = require('mongoose');
const should = require('should');
const express = require('../../../../config/lib/express.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');

const Contact = mongoose.model('Contact');
const Offer = mongoose.model('Offer');
const Tribe = mongoose.model('Tribe');

let app;
let users;
let accessToken;
let password;

async function signIn() {
  const response = await request(app)
    .post('/api/mobile/v0/auth/signin')
    .send({ username: users[0].username, password })
    .expect(200);
  accessToken = response.body.accessToken;
}

function mobileRequest(method, path) {
  return request(app)
    [method](path)
    .set('Authorization', `Bearer ${accessToken}`)
    .set('X-Trustroots-Request', '1');
}

describe('Mobile aliases for existing member features', function () {
  before(async function () {
    app = await express.init(mongoose.connection);
  });

  beforeEach(async function () {
    const generated = utils.generateUsers(2, { public: true });
    password = generated[0].password;
    users = await utils.saveUsers(generated);
    await signIn();
  });

  afterEach(utils.clearDatabase);

  it('loads a mini member through bearer authentication', async function () {
    const response = await mobileRequest(
      'get',
      `/api/mobile/v0/members/${users[1]._id}`,
    ).expect(200);

    response.body._id.should.equal(users[1]._id.toString());
    should.not.exist(response.headers['set-cookie']);
  });

  it('loads and removes a contact through bearer aliases', async function () {
    const contact = await new Contact({
      userFrom: users[0]._id,
      userTo: users[1]._id,
      confirmed: true,
    }).save();

    const loaded = await mobileRequest(
      'get',
      `/api/mobile/v0/contact-by/${users[1]._id}`,
    ).expect(200);
    loaded.body._id.should.equal(contact._id.toString());

    await mobileRequest(
      'delete',
      `/api/mobile/v0/contact/${contact._id}`,
    ).expect(200);
    should.not.exist(await Contact.findById(contact._id));
  });

  it('returns unified push configuration without a browser session', async function () {
    const response = await mobileRequest(
      'get',
      '/api/mobile/v0/users/unified-push',
    ).expect(200);

    response.body.should.have.property('enabled');
    should.not.exist(response.headers['set-cookie']);
  });

  it('loads a circle and its members through bearer aliases', async function () {
    const tribe = await new Tribe({
      slug: 'sample-circle',
      label: 'Sample Circle',
      public: true,
    }).save();
    users[0].member = [{ tribe: tribe._id, since: new Date() }];
    await users[0].save();

    const circle = await mobileRequest(
      'get',
      `/api/mobile/v0/circles/${tribe.slug}`,
    ).expect(200);
    circle.body.slug.should.equal(tribe.slug);

    const members = await mobileRequest(
      'get',
      `/api/mobile/v0/circles/${tribe.slug}/members`,
    ).expect(200);
    members.body.should.have.properties('contacts', 'recommenders', 'active');
  });

  it('creates and updates an offer through bearer aliases', async function () {
    await mobileRequest('post', '/api/mobile/v0/offers')
      .send({
        type: 'host',
        status: 'yes',
        description: 'A fictional hosting offer',
        location: [1, 1],
      })
      .expect(200);

    const offer = await Offer.findOne({ user: users[0]._id });
    should.exist(offer);

    await mobileRequest('put', `/api/mobile/v0/offers/${offer._id}`)
      .send({ description: 'An updated fictional offer', location: [1, 1] })
      .expect(200);
    const updated = await Offer.findById(offer._id);
    updated.description.should.equal('An updated fictional offer');
  });
});
