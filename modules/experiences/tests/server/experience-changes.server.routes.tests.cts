import type {
  ExperienceDocument,
  ExperienceModel,
  ExperienceRecord,
  TestAgent,
  TestExpressModule,
  UserDocument,
  UserModel,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';
const crypto: typeof import('crypto') = require('crypto');
const mongoose: typeof import('mongoose') = require('mongoose');
const request: typeof import('supertest') = require('supertest');
const sinon: typeof import('sinon') = require('sinon');
require('should');

const express: TestExpressModule = require('../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil') = require('../../../../testutils/server/data.server.testutil');
const statistics: typeof import('../../../statistics/server/controllers/statistics.server.controller.mjs') = require('../../../statistics/server/controllers/statistics.server.controller.mjs');
const publishExperiences: typeof import('../../server/jobs/experiences-publish.server.job.mjs') = require('../../server/jobs/experiences-publish.server.job.mjs');
const adminChanges: typeof import('../../../admin/server/controllers/admin.experience-changes.server.controller.mjs') = require('../../../admin/server/controllers/admin.experience-changes.server.controller.mjs');
const memberChanges: typeof import('../../server/controllers/experience-changes.server.controller.mjs') = require('../../server/controllers/experience-changes.server.controller.mjs');
const experiencePolicy: typeof import('../../server/policies/experiences.server.policy.mts') = require('../../server/policies/experiences.server.policy.mts');

const Experience = mongoose.model<ExperienceRecord, ExperienceModel>(
  'Experience',
);
const ExperienceChangeLink = mongoose.model('ExperienceChangeLink');
const ExperienceChangeRequest = mongoose.model('ExperienceChangeRequest');
const AuditLog = mongoose.model('AuditLog');
const User = mongoose.model<UserRecord, UserModel>('User');
type ExperienceStatistics = {
  total: number;
  realLifeConnections: { total: number };
};
type StatisticsController = {
  getExperienceStatistics(
    since: Date,
    callback: (error: Error | null, result: ExperienceStatistics) => void,
  ): void;
};
const typedStatistics = statistics as unknown as StatisticsController;
type PublishExperiencesJob = (
  job: null,
  done: (error: Error | null) => void,
) => void;
const typedPublishExperiences =
  publishExperiences as unknown as PublishExperiencesJob;
type MemberRequest = Parameters<typeof memberChanges.submit>[0];
type AdminIssueRequest = Parameters<typeof adminChanges.issueLink>[0];
type AdminFindRequest = Parameters<typeof adminChanges.findExperiences>[0];
type AdminListRequest = Parameters<typeof adminChanges.listRequests>[0];
type AdminDecisionRequest = Parameters<typeof adminChanges.decide>[0];
type PolicyRequest = Parameters<typeof experiencePolicy.isAllowedChange>[0];
interface TestResponse {
  status(code: number): TestResponse;
  json(body: unknown): TestResponse;
  send(body: unknown): TestResponse;
}
const createTestResponse = () => {
  const statusSpy = sinon.spy();
  const jsonSpy = sinon.spy();
  const sendSpy = sinon.spy();
  const response: TestResponse = {
    status(code) {
      statusSpy(code);
      return response;
    },
    json(body) {
      jsonSpy(body);
      return response;
    },
    send(body) {
      sendSpy(body);
      return response;
    },
  };
  return { response, statusSpy, jsonSpy, sendSpy };
};

describe('Experience change requests', () => {
  let adminAgent: TestAgent;
  let authorAgent: TestAgent;
  let recipientAgent: TestAgent;
  let unrelatedAgent: TestAgent;

  before(async () => {
    const app = await express.init(mongoose.connection);
    adminAgent = request.agent(app);
    authorAgent = request.agent(app);
    recipientAgent = request.agent(app);
    unrelatedAgent = request.agent(app);
  });
  const users = utils.generateUsers(4, { public: true });
  users[0].roles = ['user', 'admin'];

  let author: UserDocument;
  let recipient: UserDocument;
  let experience: ExperienceDocument;

  async function issue(memberId: string) {
    const response = await adminAgent
      .post(`/api/admin/experiences/${experience._id}/change-links`)
      .send({ memberId })
      .expect(201);
    const secret = new URL(
      response.body.path,
      'https://example.test',
    ).searchParams.get('secret');
    if (secret === null) throw new Error('Expected an issued change secret');
    return secret;
  }

  const secretHeader = (secret: string) => ({
    'X-Experience-Change-Secret': secret,
  });
  const authorIdentity = () => ({
    _id: new mongoose.Types.ObjectId(author._id.toString()),
  });

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
    await utils.signInPrivileged(users[0], adminAgent);
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
    const searchResults = search.body as Array<{ _id: string }>;
    searchResults
      .map(item => item._id)
      .should.containEql(String(experience._id));

    const secret = await issue(author._id.toString());
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
    if (!unchanged) throw new Error('Expected the original Experience');
    unchanged.feedbackPublic!.should.equal('An anonymous original Experience.');
    unchanged.recommend!.should.equal('yes');

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
    queue.body[0].experience.userFrom.username.should.equal(author.username);
    queue.body[0].experience.userTo.username.should.equal(recipient.username);

    await adminAgent
      .post(
        `/api/admin/experience-change-requests/${submitted.body._id}/decision`,
      )
      .send({ decision: 'approve' })
      .expect(200);

    const reviewed = await adminAgent
      .get('/api/admin/experience-change-requests')
      .expect(200);
    reviewed.body.should.have.length(1);
    reviewed.body[0].status.should.equal('approved');
    reviewed.body[0].experience.userFrom.username.should.equal(author.username);
    reviewed.body[0].experience.userTo.username.should.equal(
      recipient.username,
    );

    await ExperienceChangeRequest.updateOne(
      { _id: submitted.body._id },
      {
        $set: {
          reviewedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        },
      },
    );
    const agedOut = await adminAgent
      .get('/api/admin/experience-change-requests')
      .expect(200);
    agedOut.body.should.deepEqual([]);
    await ExperienceChangeRequest.updateOne(
      { _id: submitted.body._id },
      { $set: { reviewedAt: new Date() } },
    );

    const approved = await Experience.findById(experience._id).lean();
    if (!approved) throw new Error('Expected the approved Experience');
    approved.feedbackPublic!.should.equal(proposed.feedbackPublic);
    approved.recommend!.should.equal('no');
    approved.public!.should.equal(true);
    approved
      .created!.toISOString()
      .should.equal(experience.created!.toISOString());

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
    const searchResults = search.body as Array<{ _id: string }>;
    searchResults
      .map(item => item._id)
      .should.containEql(String(experience._id));
    const secret = await issue(recipient._id.toString());

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
    const rejectedRemoval = await Experience.findById(experience._id).lean();
    if (!rejectedRemoval) throw new Error('Expected the original Experience');
    rejectedRemoval.should.not.have.property('removedAt');
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
    if (!removed) throw new Error('Expected the removed Experience');
    removed.removedAt!.should.be.instanceOf(Date);
    const reciprocalAfterRemoval = await Experience.findById(
      reciprocal._id,
    ).lean();
    if (!reciprocalAfterRemoval)
      throw new Error('Expected the reciprocal Experience');
    reciprocalAfterRemoval.public!.should.equal(true);
    await authorAgent.get(`/api/experiences/${experience._id}`).expect(404);
    await authorAgent.get(`/api/experiences/${reciprocal._id}`).expect(200);
    const listed = await recipientAgent
      .get('/api/experiences')
      .query({ userTo: recipient._id.toString() })
      .expect(200);
    (listed.body as Array<{ _id: string }>)
      .map(item => item._id)
      .should.not.containEql(String(experience._id));
    const count = await recipientAgent
      .get('/api/experiences/count')
      .query({ userTo: recipient._id.toString() })
      .expect(200);
    count.body.count.should.equal(0);
    const counts = await new Promise<ExperienceStatistics>(
      (resolve, reject) => {
        typedStatistics.getExperienceStatistics(
          new Date(0),
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );
      },
    );
    counts.total.should.equal(1);
    counts.realLifeConnections.total.should.equal(1);
    await new Promise<void>((resolve, reject) => {
      typedPublishExperiences(null, error => {
        if (error) reject(error);
        else resolve();
      });
    });
    const unpublished = await Experience.findById(experience._id).lean();
    if (!unpublished) throw new Error('Expected the unpublished Experience');
    unpublished.public!.should.equal(false);
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
    const first = await issue(author._id.toString());
    const second = await issue(author._id.toString());
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
    const recipientSecret = await issue(recipient._id.toString());
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
      .post(`/api/admin/experiences/${experience._id}/change-links`)
      .send({ memberId: 123 })
      .expect(400);
    await adminAgent
      .post(`/api/admin/experiences/${experience._id}/change-links`)
      .send({ memberId: {} })
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

    const secret = await issue(author._id.toString());
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
      'not-an-object',
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
        interactions: null,
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

  it('passes null and missing request bodies through the controller error path', async () => {
    const secret = await issue(author._id.toString());
    const next = sinon.spy();
    const { response } = createTestResponse();

    await memberChanges.submit(
      {
        params: { id: String(experience._id) },
        body: null,
        user: authorIdentity(),
        get: () => secret,
      },
      response,
      next,
    );
    next.calledOnce.should.equal(true);
    next.firstCall.args[0].should.be.instanceof(TypeError);

    next.resetHistory();
    await adminChanges.issueLink(
      {
        params: { id: String(experience._id) },
        body: undefined,
        query: {},
        user: authorIdentity(),
      },
      response,
      next,
    );
    next.calledOnce.should.equal(true);
    next.firstCall.args[0].should.be.instanceof(TypeError);
  });

  it('checks invalid admin IDs before reading null request bodies', async () => {
    const next = sinon.spy();
    const { response, statusSpy, jsonSpy } = createTestResponse();

    await adminChanges.issueLink(
      {
        params: { id: 'invalid' },
        query: {},
        body: null,
        user: authorIdentity(),
      },
      response,
      next,
    );
    statusSpy.calledWith(400).should.equal(true);
    jsonSpy
      .calledWith({ message: 'Invalid Experience or member.' })
      .should.equal(true);
    next.called.should.equal(false);

    statusSpy.resetHistory();
    jsonSpy.resetHistory();
    await adminChanges.decide(
      {
        params: { id: 'invalid' },
        query: {},
        body: null,
        user: authorIdentity(),
      },
      response,
      next,
    );
    statusSpy.calledWith(400).should.equal(true);
    jsonSpy
      .calledWith({ message: 'Invalid review decision.' })
      .should.equal(true);
    next.called.should.equal(false);
  });

  it('keeps a failed approval pending for retry and reports a processing request as pending', async () => {
    const secret = await issue(author._id.toString());
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
    if (!pending) throw new Error('Expected the request to remain pending');
    pending.status.should.equal('pending');
  });

  it('returns a conflict when a concurrent request wins the unique index', async () => {
    const secret = await issue(author._id.toString());
    sinon.stub(ExperienceChangeRequest, 'create').rejects({ code: 11000 });
    await authorAgent
      .post(`/api/experiences/${experience._id}/change-requests`)
      .set(secretHeader(secret))
      .send({ kind: 'remove' })
      .expect(409);
  });

  it('preserves the error path for nullish and primitive create rejections', async () => {
    const secret = await issue(author._id.toString());
    const { response } = createTestResponse();
    const request: MemberRequest = {
      params: { id: String(experience._id) },
      body: { kind: 'remove' },
      user: authorIdentity(),
      get: () => secret,
    };

    for (const error of [null, undefined]) {
      sinon
        .stub(ExperienceChangeRequest, 'create')
        .callsFake(() => Promise.reject(error));
      let rejected: unknown;
      try {
        await memberChanges.submit(request, response, sinon.spy());
      } catch (caught) {
        rejected = caught;
      }
      if (!(rejected instanceof TypeError)) {
        throw new Error('Expected the rejected handler to throw a TypeError');
      }
      rejected.should.be.instanceof(TypeError);
      sinon.restore();
    }

    const primitiveError = 'Database unavailable';
    const next = sinon.spy();
    sinon
      .stub(ExperienceChangeRequest, 'create')
      .callsFake(() => Promise.reject(primitiveError));
    await memberChanges.submit(request, response, next);
    next.calledOnceWithExactly(primitiveError).should.equal(true);
    sinon.restore();
  });

  it('passes database failures to the API error handler', async () => {
    const error = new Error('Database unavailable');
    const next = sinon.spy();
    sinon.stub(Experience, 'findById').throws(error);
    const memberRequest: MemberRequest = {
      params: { id: String(experience._id) },
      body: undefined,
      user: authorIdentity(),
      get: () => undefined,
    };
    await memberChanges.readAccess(
      memberRequest,
      createTestResponse().response,
      next,
    );
    await memberChanges.readMine(
      memberRequest,
      createTestResponse().response,
      next,
    );
    await memberChanges.submit(
      memberRequest,
      createTestResponse().response,
      next,
    );
    next.callCount.should.equal(3);
    next.alwaysCalledWithExactly(error).should.equal(true);
    sinon.restore();

    sinon.stub(User, 'findOne').throws(error);
    await adminChanges.findExperiences(
      {
        params: {},
        query: { username: 'fictional' },
        body: undefined,
        user: authorIdentity(),
      } satisfies AdminFindRequest,
      createTestResponse().response,
      next,
    );
    sinon.restore();
    sinon.stub(Experience, 'findOne').throws(error);
    await adminChanges.issueLink(
      {
        params: { id: String(experience._id) },
        body: { memberId: String(author._id) },
        query: {},
        user: authorIdentity(),
      } satisfies AdminIssueRequest,
      createTestResponse().response,
      next,
    );
    sinon.restore();
    sinon.stub(ExperienceChangeRequest, 'find').throws(error);
    await adminChanges.listRequests(
      {
        params: {},
        query: {},
        body: undefined,
        user: authorIdentity(),
      } satisfies AdminListRequest,
      createTestResponse().response,
      next,
    );
    sinon.restore();
    sinon.stub(ExperienceChangeRequest, 'findOneAndUpdate').throws(error);
    await adminChanges.decide(
      {
        params: { id: String(experience._id) },
        body: { decision: 'approve' },
        query: {},
        user: authorIdentity(),
      } satisfies AdminDecisionRequest,
      createTestResponse().response,
      next,
    );
    next.callCount.should.equal(7);
    next.alwaysCalledWithExactly(error).should.equal(true);
  });

  it('denies unauthenticated policy calls and passes policy errors onward', async () => {
    const { response, statusSpy } = createTestResponse();
    const next = sinon.spy();
    const route = { path: '/api/experiences/:id/change-access' };
    await experiencePolicy.isAllowedChange(
      { user: null, route, method: 'GET' } as unknown as PolicyRequest,
      response,
      next,
    );
    statusSpy.calledWith(403).should.equal(true);
    await experiencePolicy.isAllowedChange(
      { user: { _id: { valueOf: () => '' } }, route, method: 'GET' },
      response,
      next,
    );
    statusSpy.calledTwice.should.equal(true);
    await experiencePolicy.isAllowedChange(
      {
        user: { roles: ['user'], _id: { valueOf: () => '' } },
        method: 'GET',
      } as unknown as PolicyRequest,
      response,
      next,
    );
    next.calledOnce.should.equal(true);
    next.firstCall.args[0].should.be.instanceOf(TypeError);
  });
});
