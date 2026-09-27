const crypto = require('crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const sinon = require('sinon');
require('should');

const express = require('../../../../config/lib/express');
const utils = require('../../../../testutils/server/data.server.testutil');
const statistics = require('../../../statistics/server/controllers/statistics.server.controller');
const publishExperiences = require('../../server/jobs/experiences-publish.server.job');
const adminChanges = require('../../../admin/server/controllers/admin.experience-changes.server.controller');
const memberChanges = require('../../server/controllers/experience-changes.server.controller');
const experiencePolicy = require('../../server/policies/experiences.server.policy');

const Experience = mongoose.model('Experience');
const ExperienceChangeLink = mongoose.model('ExperienceChangeLink');
const ExperienceChangeRequest = mongoose.model('ExperienceChangeRequest');
const AuditLog = mongoose.model('AuditLog');
const User = mongoose.model('User');

describe('Experience change requests', () => {
  const app = express.init(mongoose.connection);
  const adminAgent = request.agent(app);
  const authorAgent = request.agent(app);
  const recipientAgent = request.agent(app);
  const unrelatedAgent = request.agent(app);
  const users = utils.generateUsers(4, { public: true });
  users[0].roles = ['user', 'admin'];

  let author;
  let recipient;
  let experience;

  async function issue(memberId) {
    const response = await adminAgent
      .post(`/api/admin/experiences/${experience._id}/change-links`)
      .send({ memberId })
      .expect(201);
    return new URL(response.body.path, 'https://example.test').searchParams.get(
      'secret',
    );
  }

  const secretHeader = secret => ({ 'X-Experience-Change-Secret': secret });

  beforeEach(async () => {
    [, author, recipient] = await utils.saveUsers(users);
    experience = await Experience.create({
      userFrom: author._id,
      userTo: recipient._id,
      public: true,
      interactions: { met: true, host: false, guest: false },
      recommend: 'yes',
      feedbackPublic: 'An anonymous original Experience.',
    });
    await utils.signIn(users[0], adminAgent);
    await utils.signIn(users[1], authorAgent);
    await utils.signIn(users[2], recipientAgent);
    await utils.signIn(users[3], unrelatedAgent);
  });

  afterEach(async () => {
    sinon.restore();
    await Promise.all([
      utils.signOut(adminAgent),
      utils.signOut(authorAgent),
      utils.signOut(recipientAgent),
      utils.signOut(unrelatedAgent),
    ]);
    await utils.clearDatabase();
  });

  it('issues a scoped link, keeps an edit pending, and applies an approved edit', async () => {
    const search = await adminAgent
      .get('/api/admin/experiences')
      .query({ username: users[1].username })
      .expect(200);
    search.body.map(item => item._id).should.containEql(String(experience._id));

    const secret = await issue(author._id);
    const link = await ExperienceChangeLink.findOne({
      experience: experience._id,
      member: author._id,
    }).lean();
    link.tokenHash.should.equal(
      crypto.createHash('sha256').update(secret).digest('hex'),
    );
    link.tokenHash.should.not.equal(secret);
    const audit = await AuditLog.findOne({
      route: '/api/admin/experiences/:id/change-links',
    }).lean();
    JSON.stringify(audit).should.not.containEql(secret);

    const access = await authorAgent
      .get(`/api/experiences/${experience._id}/change-access`)
      .set(secretHeader(secret))
      .expect(200);
    access.body.canEdit.should.equal(true);
    await Experience.updateOne(
      { _id: experience._id },
      { $set: { feedbackPublic: '' } },
    );
    const emptyFeedback = await authorAgent
      .get(`/api/experiences/${experience._id}/change-access`)
      .set(secretHeader(secret))
      .expect(200);
    emptyFeedback.body.feedbackPublic.should.equal('');
    await Experience.updateOne(
      { _id: experience._id },
      { $set: { feedbackPublic: 'An anonymous original Experience.' } },
    );

    const proposed = {
      feedbackPublic: 'An anonymous revised Experience.',
      recommend: 'no',
      interactions: { met: true, host: true, guest: false },
    };
    const submitted = await authorAgent
      .post(`/api/experiences/${experience._id}/change-requests`)
      .set(secretHeader(secret))
      .send({ kind: 'edit', proposed })
      .expect(201);
    submitted.body.status.should.equal('pending');

    const unchanged = await Experience.findById(experience._id).lean();
    unchanged.feedbackPublic.should.equal('An anonymous original Experience.');
    unchanged.recommend.should.equal('yes');

    await authorAgent
      .post(`/api/experiences/${experience._id}/change-requests`)
      .set(secretHeader(secret))
      .send({ kind: 'remove' })
      .expect(409);

    const queue = await adminAgent
      .get('/api/admin/experience-change-requests')
      .expect(200);
    queue.body.should.have.length(1);
    queue.body[0].proposed.feedbackPublic.should.equal(proposed.feedbackPublic);

    await adminAgent
      .post(
        `/api/admin/experience-change-requests/${submitted.body._id}/decision`,
      )
      .send({ decision: 'approve' })
      .expect(200);

    const approved = await Experience.findById(experience._id).lean();
    approved.feedbackPublic.should.equal(proposed.feedbackPublic);
    approved.recommend.should.equal('no');
    approved.public.should.equal(true);
    approved.created
      .toISOString()
      .should.equal(experience.created.toISOString());

    const mine = await authorAgent
      .get(`/api/experiences/${experience._id}/change-requests/mine`)
      .expect(200);
    mine.body.status.should.equal('approved');
    await ExperienceChangeLink.updateOne(
      { experience: experience._id, member: author._id },
      { $set: { expiresAt: new Date(0) } },
    );
    const statusAfterExpiry = await authorAgent
      .get(`/api/experiences/${experience._id}/change-requests/mine`)
      .expect(200);
    statusAfterExpiry.body.status.should.equal('approved');
    await adminAgent
      .post(
        `/api/admin/experience-change-requests/${submitted.body._id}/decision`,
      )
      .send({ decision: 'approve' })
      .expect(409);
  });

  it('allows the recipient to request removal, then hides only the approved Experience', async () => {
    experience.public = false;
    experience.created = new Date(0);
    await experience.save();
    const reciprocal = await Experience.create({
      userFrom: recipient._id,
      userTo: author._id,
      public: true,
      interactions: { met: true, host: false, guest: true },
      recommend: 'yes',
      feedbackPublic: 'An anonymous reciprocal Experience.',
    });
    const search = await adminAgent
      .get('/api/admin/experiences')
      .query({ username: users[2].username })
      .expect(200);
    search.body.map(item => item._id).should.containEql(String(experience._id));
    const secret = await issue(recipient._id);

    const access = await recipientAgent
      .get(`/api/experiences/${experience._id}/change-access`)
      .set(secretHeader(secret))
      .expect(200);
    access.body.canEdit.should.equal(false);
    access.body.should.not.have.property('feedbackPublic');
    await recipientAgent
      .post(`/api/experiences/${experience._id}/change-requests`)
      .set(secretHeader(secret))
      .send({
        kind: 'edit',
        proposed: {
          feedbackPublic: 'Changed',
          recommend: 'no',
          interactions: { met: true, host: false, guest: false },
        },
      })
      .expect(403);

    const submitted = await recipientAgent
      .post(`/api/experiences/${experience._id}/change-requests`)
      .set(secretHeader(secret))
      .send({ kind: 'remove' })
      .expect(201);
    await adminAgent
      .post(
        `/api/admin/experience-change-requests/${submitted.body._id}/decision`,
      )
      .send({ decision: 'reject' })
      .expect(200);
    (await Experience.findById(experience._id).lean()).should.not.have.property(
      'removedAt',
    );
    const second = await recipientAgent
      .post(`/api/experiences/${experience._id}/change-requests`)
      .set(secretHeader(secret))
      .send({ kind: 'remove' })
      .expect(201);
    await adminAgent
      .post(`/api/admin/experience-change-requests/${second.body._id}/decision`)
      .send({ decision: 'approve' })
      .expect(200);

    const removed = await Experience.findById(experience._id).lean();
    removed.removedAt.should.be.instanceOf(Date);
    (await Experience.findById(reciprocal._id).lean()).public.should.equal(
      true,
    );
    await authorAgent.get(`/api/experiences/${experience._id}`).expect(404);
    await authorAgent.get(`/api/experiences/${reciprocal._id}`).expect(200);
    const listed = await recipientAgent
      .get('/api/experiences')
      .query({ userTo: recipient._id.toString() })
      .expect(200);
    listed.body
      .map(item => item._id)
      .should.not.containEql(String(experience._id));
    const count = await recipientAgent
      .get('/api/experiences/count')
      .query({ userTo: recipient._id.toString() })
      .expect(200);
    count.body.count.should.equal(0);
    const counts = await new Promise((resolve, reject) => {
      statistics.getExperienceStatistics(new Date(0), (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
    counts.total.should.equal(1);
    counts.realLifeConnections.total.should.equal(1);
    await new Promise((resolve, reject) => {
      publishExperiences(null, error => {
        if (error) reject(error);
        else resolve();
      });
    });
    (await Experience.findById(experience._id).lean()).public.should.equal(
      false,
    );
    await authorAgent
      .post('/api/experiences')
      .send({
        userTo: recipient._id,
        interactions: { met: true, host: false, guest: false },
        recommend: 'yes',
        feedbackPublic: 'An anonymous replacement Experience.',
      })
      .expect(409);
    const mine = await recipientAgent
      .get(`/api/experiences/${experience._id}/change-requests/mine`)
      .expect(200);
    mine.body.status.should.equal('approved');
    await recipientAgent
      .get(`/api/experiences/${experience._id}/change-access`)
      .set(secretHeader(secret))
      .expect(404);
  });

  it('rejects expired, replaced, unrelated, and unauthorised links', async () => {
    const first = await issue(author._id);
    const second = await issue(author._id);
    first.should.not.equal(second);
    await authorAgent
      .get(`/api/experiences/${experience._id}/change-access`)
      .set(secretHeader(first))
      .expect(403);
    await recipientAgent
      .get(`/api/experiences/${experience._id}/change-access`)
      .set(secretHeader(second))
      .expect(403);
    author.public = false;
    await author.save();
    await authorAgent
      .get(`/api/experiences/${experience._id}/change-access`)
      .set(secretHeader(second))
      .expect(200);
    const recipientSecret = await issue(recipient._id);
    const recipientAccess = await recipientAgent
      .get(`/api/experiences/${experience._id}/change-access`)
      .set(secretHeader(recipientSecret))
      .expect(200);
    recipientAccess.body.canEdit.should.equal(false);
    recipientAccess.body.feedbackPublic.should.equal(
      'An anonymous original Experience.',
    );
    await unrelatedAgent
      .get(`/api/experiences/${experience._id}/change-access`)
      .set(secretHeader(second))
      .expect(404);
    await ExperienceChangeLink.updateOne(
      { experience: experience._id, member: author._id },
      { $set: { expiresAt: new Date(0) } },
    );
    await authorAgent
      .post(`/api/experiences/${experience._id}/change-requests`)
      .set(secretHeader(second))
      .send({ kind: 'remove' })
      .expect(403);
    await authorAgent
      .get(`/api/experiences/${experience._id}/change-requests/mine`)
      .expect(200);
    const none = await ExperienceChangeRequest.countDocuments();
    none.should.equal(0);

    await authorAgent.get('/api/admin/experience-change-requests').expect(403);
    await authorAgent
      .post(`/api/admin/experiences/${experience._id}/change-links`)
      .send({ memberId: author._id })
      .expect(403);
  });

  it('validates admin selection and member change payloads', async () => {
    await adminAgent.get('/api/admin/experiences').expect(400);
    await adminAgent
      .get('/api/admin/experiences')
      .query({ username: 'x'.repeat(101) })
      .expect(400);
    const unknown = await adminAgent
      .get('/api/admin/experiences')
      .query({ username: 'fictional-nobody' })
      .expect(200);
    unknown.body.should.deepEqual([]);
    await adminAgent
      .post('/api/admin/experiences/invalid/change-links')
      .send({ memberId: author._id })
      .expect(400);
    await adminAgent
      .post(`/api/admin/experiences/${experience._id}/change-links`)
      .send({ memberId: 'invalid' })
      .expect(400);
    await adminAgent
      .post(
        `/api/admin/experiences/${new mongoose.Types.ObjectId()}/change-links`,
      )
      .send({ memberId: author._id })
      .expect(404);
    await adminAgent
      .post(`/api/admin/experiences/${experience._id}/change-links`)
      .send({ memberId: new mongoose.Types.ObjectId() })
      .expect(400);
    await adminAgent
      .post('/api/admin/experience-change-requests/invalid/decision')
      .send({ decision: 'approve' })
      .expect(400);
    await adminAgent
      .post(
        `/api/admin/experience-change-requests/${new mongoose.Types.ObjectId()}/decision`,
      )
      .send({ decision: 'invalid' })
      .expect(400);

    const secret = await issue(author._id);
    await authorAgent
      .get('/api/experiences/invalid/change-access')
      .set(secretHeader(secret))
      .expect(400);
    await authorAgent
      .get('/api/experiences/invalid/change-requests/mine')
      .expect(400);
    await authorAgent
      .get(`/api/experiences/${experience._id}/change-access`)
      .expect(403);
    await authorAgent
      .get(`/api/experiences/${experience._id}/change-access`)
      .set(secretHeader('invalid'))
      .expect(403);
    await authorAgent
      .post(`/api/experiences/${experience._id}/change-requests`)
      .set(secretHeader(secret))
      .send({ kind: 'invalid' })
      .expect(400);
    await authorAgent
      .post('/api/experiences/invalid/change-requests')
      .set(secretHeader(secret))
      .send({ kind: 'remove' })
      .expect(400);
    await authorAgent
      .post(`/api/experiences/${experience._id}/change-requests`)
      .set(secretHeader(secret))
      .send({ kind: 'remove', proposed: {} })
      .expect(400);
    for (const proposed of [
      undefined,
      {
        feedbackPublic: 'Changed',
        recommend: 'invalid',
        interactions: { met: true, host: false, guest: false },
      },
      {
        feedbackPublic: 'Changed',
        recommend: 'no',
        interactions: { met: 'yes', host: false, guest: false },
      },
      {
        feedbackPublic: 'Changed',
        recommend: 'no',
        interactions: { met: false, host: false, guest: false },
      },
      {
        feedbackPublic: 'x'.repeat(3000),
        recommend: 'no',
        interactions: { met: true, host: false, guest: false },
      },
    ]) {
      await authorAgent
        .post(`/api/experiences/${experience._id}/change-requests`)
        .set(secretHeader(secret))
        .send({ kind: 'edit', proposed })
        .expect(400);
    }
  });

  it('keeps a failed approval pending for retry and reports a processing request as pending', async () => {
    const secret = await issue(author._id);
    const submitted = await authorAgent
      .post(`/api/experiences/${experience._id}/change-requests`)
      .set(secretHeader(secret))
      .send({ kind: 'remove' })
      .expect(201);
    await ExperienceChangeRequest.updateOne(
      { _id: submitted.body._id },
      { $set: { status: 'processing' } },
    );
    const mine = await authorAgent
      .get(`/api/experiences/${experience._id}/change-requests/mine`)
      .expect(200);
    mine.body.status.should.equal('pending');
    await ExperienceChangeRequest.updateOne(
      { _id: submitted.body._id },
      { $set: { status: 'pending' } },
    );
    await Experience.updateOne(
      { _id: experience._id },
      { $set: { removedAt: new Date() } },
    );
    await adminAgent
      .post(
        `/api/admin/experience-change-requests/${submitted.body._id}/decision`,
      )
      .send({ decision: 'approve' })
      .expect(500);
    const pending = await ExperienceChangeRequest.findById(submitted.body._id);
    pending.status.should.equal('pending');
  });

  it('returns a conflict when a concurrent request wins the unique index', async () => {
    const secret = await issue(author._id);
    sinon.stub(ExperienceChangeRequest, 'create').rejects({ code: 11000 });
    await authorAgent
      .post(`/api/experiences/${experience._id}/change-requests`)
      .set(secretHeader(secret))
      .send({ kind: 'remove' })
      .expect(409);
  });

  it('passes database failures to the API error handler', async () => {
    const error = new Error('Database unavailable');
    const next = sinon.spy();
    sinon.stub(Experience, 'findById').throws(error);
    const memberRequest = {
      params: { id: String(experience._id) },
      user: author,
    };
    await memberChanges.readAccess(memberRequest, {}, next);
    await memberChanges.readMine(memberRequest, {}, next);
    await memberChanges.submit(memberRequest, {}, next);
    next.callCount.should.equal(3);
    next.alwaysCalledWithExactly(error).should.equal(true);
    sinon.restore();

    sinon.stub(User, 'findOne').throws(error);
    await adminChanges.findExperiences(
      { query: { username: 'fictional' } },
      {},
      next,
    );
    sinon.restore();
    sinon.stub(Experience, 'findOne').throws(error);
    await adminChanges.issueLink(
      {
        params: { id: String(experience._id) },
        body: { memberId: String(author._id) },
      },
      {},
      next,
    );
    sinon.restore();
    sinon.stub(ExperienceChangeRequest, 'find').throws(error);
    await adminChanges.listRequests({}, {}, next);
    sinon.restore();
    sinon.stub(ExperienceChangeRequest, 'findOneAndUpdate').throws(error);
    await adminChanges.decide(
      { params: { id: String(experience._id) }, body: { decision: 'approve' } },
      {},
      next,
    );
    next.callCount.should.equal(7);
    next.alwaysCalledWithExactly(error).should.equal(true);
  });

  it('denies unauthenticated policy calls and passes policy errors onward', async () => {
    const response = {
      status: sinon.stub().returnsThis(),
      json: sinon.spy(),
    };
    const next = sinon.spy();
    const route = { path: '/api/experiences/:id/change-access' };
    await experiencePolicy.isAllowedChange(
      { user: null, route, method: 'GET' },
      response,
      next,
    );
    response.status.calledWith(403).should.equal(true);
    await experiencePolicy.isAllowedChange(
      { user: {}, route, method: 'GET' },
      response,
      next,
    );
    response.status.calledTwice.should.equal(true);
    await experiencePolicy.isAllowedChange(
      { user: { roles: ['user'] }, method: 'GET' },
      response,
      next,
    );
    next.calledOnce.should.equal(true);
    next.firstCall.args[0].should.be.instanceOf(TypeError);
  });
});
