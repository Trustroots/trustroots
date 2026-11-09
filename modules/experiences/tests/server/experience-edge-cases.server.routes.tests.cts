import type {
  ContactModel,
  ContactRecord,
  ExperienceModel,
  ExperienceRecord,
  TestAgent,
  TestExpressModule,
  UserDocument,
} from '../../../../testutils/server/model-contracts.mts';
const mongoose: typeof import('mongoose') = require('mongoose');
const request: typeof import('supertest') = require('supertest');
const should: typeof import('should') = require('should');
const utils: typeof import('../../../../testutils/server/data.server.testutil') = require('../../../../testutils/server/data.server.testutil');
const express: TestExpressModule = require('../../../../config/lib/express.mjs');
require('../../../contacts/server/models/contacts.server.model.mjs');
const Contact = mongoose.model<ContactRecord, ContactModel>('Contact');
const Experience = mongoose.model<ExperienceRecord, ExperienceModel>(
  'Experience',
);

const interactions = { met: true, guest: false, host: false };

describe('Experience route edge cases', () => {
  let agent: TestAgent;
  let users: UserDocument[];
  const userData = utils.generateUsersWithSharedPassword(5, { public: true });

  before(async () => {
    agent = request.agent(await express.init(mongoose.connection));
  });
  beforeEach(async () => {
    users = await utils.saveUsersWithCachedPasswords(userData);
    await utils.signIn(userData[0], agent);
  });
  afterEach(async () => {
    await utils.signOut(agent);
    await utils.clearDatabase();
  });

  async function shared(
    from: UserDocument,
    to: UserDocument,
    extra: Partial<ExperienceRecord> = {},
  ) {
    return Experience.create({
      userFrom: from._id,
      userTo: to._id,
      public: true,
      recommend: 'yes',
      interactions,
      ...extra,
    });
  }

  describe('reply recipient', () => {
    it('finds an author by any casing of the username', async () => {
      await shared(users[1], users[0]);
      const mixed = users[1].username
        .split('')
        .map((char, index) => (index % 2 ? char.toUpperCase() : char))
        .join('');
      const { body } = await agent
        .get(`/api/experiences/reply-recipient/${mixed}`)
        .expect(200);
      body.should.deepEqual({
        _id: users[1]._id.toString(),
        username: users[1].username,
        displayName: users[1].displayName,
      });
    });

    it('answers strangers with a not found message', async () => {
      const { body } = await agent
        .get(`/api/experiences/reply-recipient/${users[2].username}`)
        .expect(404);
      body.should.deepEqual({ message: 'Not found.' });
    });
  });

  describe('suggestion', () => {
    async function befriend(
      from: UserDocument,
      to: UserDocument,
      confirmed = true,
    ) {
      await Contact.create({ userFrom: from._id, userTo: to._id, confirmed });
    }

    it('suggests a contact I requested', async () => {
      await befriend(users[0], users[1]);
      const { body } = await agent
        .get('/api/experiences/suggestion')
        .expect(200);
      body.should.deepEqual({
        _id: users[1]._id.toString(),
        displayName: users[1].displayName,
        username: users[1].username,
      });
    });

    it('suggests a contact who experienced others, not only unseen members', async () => {
      await befriend(users[1], users[0]);
      await shared(users[2], users[1]);
      await shared(users[0], users[3]);
      const { body } = await agent
        .get('/api/experiences/suggestion')
        .expect(200);
      body._id.should.equal(users[1]._id.toString());
    });

    it('ignores contacts between other members and unconfirmed ones', async () => {
      await befriend(users[2], users[3]);
      await befriend(users[0], users[4], false);
      const { body } = await agent
        .get('/api/experiences/suggestion')
        .expect(200);
      should(body).equal(null);
    });

    it('skips members who blocked me even if I did not block them', async () => {
      await befriend(users[0], users[1]);
      users[1].blocked = [new mongoose.Types.ObjectId(String(users[0]._id))];
      await users[1].save();
      const { body } = await agent
        .get('/api/experiences/suggestion')
        .expect(200);
      should(body).equal(null);
    });

    it('skips suspended and shadowbanned contacts', async () => {
      await befriend(users[0], users[1]);
      await befriend(users[2], users[0]);
      users[1].roles = ['user', 'suspended'];
      users[2].roles = ['user', 'shadowban'];
      await users[1].save();
      await users[2].save();
      const { body } = await agent
        .get('/api/experiences/suggestion')
        .expect(200);
      should(body).equal(null);
    });
  });

  describe('create', () => {
    const create = (extra: Record<string, unknown> = {}) =>
      agent.post('/api/experiences').send({
        userTo: users[1]._id,
        interactions,
        recommend: 'yes',
        ...extra,
      });

    it('accepts the recommendation unknown', async () => {
      await create({ recommend: 'unknown' }).expect(201);
      const stored = await Experience.findOne();
      should(stored!.recommend).equal('unknown');
    });

    it('stores no text when none is given and keeps the body free of messages', async () => {
      const { body } = await create().expect(201);
      body.should.not.have.property('message');
      body.should.not.have.property('feedbackPublic');
      const stored = await Experience.collection.findOne({});
      should(stored).not.have.property('feedbackPublic');
    });

    it('keeps inner whitespace and line breaks of the text', async () => {
      const feedbackPublic = 'first  line\n\nsecond   line';
      const { body } = await create({ feedbackPublic }).expect(201);
      body.feedbackPublic.should.equal(feedbackPublic);
      const stored = await Experience.findOne();
      should(stored!.feedbackPublic).equal(feedbackPublic);
    });

    it('limits the text to 2000 characters', async () => {
      await create({ feedbackPublic: 'x'.repeat(2000) }).expect(201);
      await Experience.deleteMany();
      const { body } = await create({
        feedbackPublic: 'x'.repeat(2001),
      }).expect(400);
      body.should.deepEqual({
        message: 'Bad request.',
        details: { feedbackPublic: 'toolong' },
      });
      (await Experience.countDocuments()).should.equal(0);
    });

    it('reports exactly which part of the body is unexpected', async () => {
      const topLevel = await create({ extra: true }).expect(400);
      topLevel.body.should.deepEqual({
        message: 'Bad request.',
        details: { fields: 'unexpected' },
      });
      const nested = await create({
        interactions: { ...interactions, extra: true },
      }).expect(400);
      nested.body.should.deepEqual({
        message: 'Bad request.',
        details: { fields: 'unexpected' },
      });
      (await Experience.countDocuments()).should.equal(0);
    });

    it('answers a duplicate with the conflict message', async () => {
      await create().expect(201);
      const { body } = await create().expect(409);
      body.should.deepEqual({ message: 'Conflict.' });
    });

    it('does not treat unrelated Experiences as a reply', async () => {
      const unrelated = await shared(users[2], users[3], { public: false });
      const { body } = await create().expect(201);
      body.public.should.equal(false);
      should(body.response).equal(null);
      const untouched = await Experience.findById(unrelated._id);
      should(untouched!.public).equal(false);
    });
  });

  describe('read many', () => {
    it('lists newest Experiences first with member details', async () => {
      (users[1] as UserDocument & { gender?: string }).gender = 'female';
      await users[1].save();
      const older = await shared(users[1], users[0], {
        created: new Date('2024-01-01'),
      });
      const newer = await shared(users[2], users[0], {
        created: new Date('2024-02-01'),
      });
      const { body } = await agent
        .get(`/api/experiences?userTo=${users[0]._id}`)
        .expect(200);
      body
        .map((experience: { _id: string }) => experience._id)
        .should.deepEqual([String(newer._id), String(older._id)]);
      const author = body[1].userFrom;
      author.gender.should.equal('female');
      author.created.should.equal(users[1].created!.toISOString());
    });
  });
});
