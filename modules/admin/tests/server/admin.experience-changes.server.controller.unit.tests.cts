import type { Types } from 'mongoose';

const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const assert: typeof import('node:assert').strict =
  require('node:assert').strict;
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');

type Handler = (
  request: unknown,
  response: unknown,
  next: (error?: unknown) => void,
) => Promise<unknown>;
// Load the controller on first use, inside a test, so that test covers (and
// can kill) mutants in its module-level constants.
const controller = new Proxy(
  {} as Record<
    'findExperiences' | 'issueLink' | 'listRequests' | 'decide',
    Handler
  >,
  {
    get: (_target, key) =>
      require('../../server/controllers/admin.experience-changes.server.controller.mts')[
        key
      ],
  },
);

type Body = Record<string, unknown> & { message?: string };
type Result = { statusCode: number; body: unknown; error?: unknown };

describe('Admin Experience changes controller', () => {
  const Experience = mongoose.model('Experience');
  const ChangeLink = mongoose.model('ExperienceChangeLink');
  const ChangeRequest = mongoose.model('ExperienceChangeRequest');
  type Member = { _id: Types.ObjectId; username: string; roles?: string[] };
  let admin: Member;
  let support: Member;
  let author: Member;
  let recipient: Member;
  let other: Member;
  let experience: { _id: Types.ObjectId };

  beforeEach(async () => {
    const users = utils.generateUsersWithSharedPassword(5, { public: true });
    users[0].roles = ['user', 'admin'];
    users[1].roles = ['user', 'support-team'];
    const saved = await utils.saveUsersWithCachedPasswords(users);
    [admin, support, author, recipient, other] = saved.map(user => ({
      _id: user._id as Types.ObjectId,
      username: user.username as string,
      roles: user.roles as string[],
    }));
    experience = await createExperience(author, recipient);
  });

  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
  });

  function createExperience(
    from: Member,
    to: Member,
    overrides: Record<string, unknown> = {},
  ) {
    return Experience.create({
      userFrom: from._id,
      userTo: to._id,
      public: true,
      interactions: { met: true, host: false, guest: false },
      recommend: 'yes',
      feedbackPublic: 'An anonymous original Experience.',
      ...overrides,
    });
  }

  async function call(
    handler: Handler,
    request: Record<string, unknown>,
  ): Promise<Result> {
    const result: Result = { statusCode: 200, body: undefined };
    const response = {
      status(code: number) {
        result.statusCode = code;
        return response;
      },
      json(body: unknown) {
        result.body = JSON.parse(JSON.stringify(body));
        return response;
      },
    };
    await handler(
      { params: {}, query: {}, body: {}, user: admin, ...request },
      response,
      error => {
        result.error = error;
      },
    );
    return result;
  }

  describe('finding Experiences', () => {
    it('trims the username and lists only the member’s active Experiences, newest first, with public profile fields', async () => {
      await createExperience(other, support);
      await createExperience(other, author, {
        removedAt: new Date(),
        removedBy: admin._id,
      });
      const newer = await createExperience(recipient, author, {
        created: new Date(Date.now() + 1000),
      });
      const result = await call(controller.findExperiences, {
        query: { username: `  ${author.username}  ` },
      });
      assert.equal(result.statusCode, 200);
      const listed = result.body as Array<{
        _id: string;
        userFrom: Record<string, unknown>;
        userTo: Record<string, unknown>;
        canIssue: boolean;
      }>;
      assert.deepEqual(
        listed.map(item => item._id),
        [String(newer._id), String(experience._id)],
      );
      for (const item of listed) {
        assert.deepEqual(Object.keys(item.userFrom).sort(), [
          '_id',
          'displayName',
          'username',
        ]);
        assert.deepEqual(Object.keys(item.userTo).sort(), [
          '_id',
          'displayName',
          'username',
        ]);
        assert.equal(item.canIssue, true);
      }
    });

    it('accepts a 100-character username and rejects longer or blank ones', async () => {
      const longest = await call(controller.findExperiences, {
        query: { username: 'a'.repeat(100) },
      });
      assert.equal(longest.statusCode, 200);
      assert.deepEqual(longest.body, []);
      for (const username of ['a'.repeat(101), '   ']) {
        const result = await call(controller.findExperiences, {
          query: { username },
        });
        assert.equal(result.statusCode, 400);
        assert.deepEqual(result.body, { message: 'Enter a member username.' });
      }
    });

    it('works for a reviewer without a roles list', async () => {
      const result = await call(controller.findExperiences, {
        query: { username: author.username },
        user: { _id: other._id },
      });
      assert.equal(result.error, undefined);
      assert.equal(result.statusCode, 200);
      assert.equal((result.body as unknown[]).length, 1);
    });
  });

  describe('issuing change links', () => {
    it('stores a link that expires in seven days', async () => {
      const before = Date.now();
      const result = await call(controller.issueLink, {
        params: { id: String(experience._id) },
        body: { memberId: String(author._id) },
      });
      assert.equal(result.statusCode, 201);
      const expiresAt = Date.parse((result.body as Body).expiresAt as string);
      const week = 7 * 24 * 60 * 60 * 1000;
      assert(expiresAt >= before + week && expiresAt <= Date.now() + week);
      const link = await ChangeLink.findOne({
        experience: experience._id,
        member: author._id,
      }).lean<{ expiresAt: Date; issuedBy: Types.ObjectId }>();
      assert(link);
      assert.equal(link.expiresAt.getTime(), expiresAt);
      assert.equal(String(link.issuedBy), String(admin._id));
    });

    it('explains invalid, missing and unrelated targets', async () => {
      const id = String(experience._id);
      for (const [target, memberId, statusCode, message] of [
        [id, 'not-an-id', 400, 'Invalid Experience or member.'],
        [
          String(new mongoose.Types.ObjectId()),
          String(author._id),
          404,
          'Experience not found.',
        ],
        [id, String(other._id), 400, 'Member is not part of this Experience.'],
      ] as const) {
        const result = await call(controller.issueLink, {
          params: { id: target },
          body: { memberId },
        });
        assert.deepEqual(result, { statusCode, body: { message } });
      }
    });

    it('refuses a support member a link for their own Experience', async () => {
      const result = await call(controller.issueLink, {
        params: { id: String(experience._id) },
        body: { memberId: String(author._id) },
        user: { _id: author._id, roles: ['user', 'support-team'] },
      });
      assert.equal(result.statusCode, 403);
      assert.deepEqual(result.body, {
        message:
          'Support members cannot change Experiences on their own profile.',
      });
    });

    it('passes a missing body to the error handler with a descriptive error', async () => {
      const result = await call(controller.issueLink, {
        params: { id: String(experience._id) },
        body: null,
      });
      assert(result.error instanceof TypeError);
      assert.equal(
        (result.error as Error).message,
        "Cannot read properties of null (reading 'memberId')",
      );
    });
  });

  describe('listing requests', () => {
    it('lists active requests oldest first, then recent approvals newest first, with public profile fields', async () => {
      const second = await createExperience(other, recipient);
      const third = await createExperience(other, author);
      const fourth = await createExperience(support, author);
      const newer = await ChangeRequest.create({
        experience: experience._id,
        requester: author._id,
        kind: 'remove',
        createdAt: new Date(Date.now() - 1000),
      });
      const older = await ChangeRequest.create({
        experience: second._id,
        requester: other._id,
        kind: 'remove',
        createdAt: new Date(Date.now() - 5000),
      });
      await ChangeRequest.create({
        experience: second._id,
        requester: other._id,
        kind: 'remove',
        status: 'rejected',
        active: false,
      });
      // Approvals older than a week drop out of the queue.
      await ChangeRequest.create({
        experience: (await createExperience(support, recipient))._id,
        requester: recipient._id,
        kind: 'edit',
        proposed: { feedbackPublic: 'Old.' },
        status: 'approved',
        active: false,
        reviewedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      });
      const earlierApproval = await ChangeRequest.create({
        experience: third._id,
        requester: author._id,
        kind: 'edit',
        proposed: { feedbackPublic: 'Earlier.' },
        status: 'approved',
        active: false,
        reviewedAt: new Date(Date.now() - 60_000),
      });
      const laterApproval = await ChangeRequest.create({
        experience: fourth._id,
        requester: author._id,
        kind: 'edit',
        proposed: { feedbackPublic: 'Later.' },
        status: 'approved',
        active: false,
        reviewedAt: new Date(Date.now() - 1000),
      });
      const result = await call(controller.listRequests, {});
      assert.equal(result.statusCode, 200);
      const listed = result.body as Array<{
        _id: string;
        requester: Record<string, unknown>;
        experience: {
          userFrom: Record<string, unknown>;
          userTo: Record<string, unknown>;
        };
      }>;
      assert.deepEqual(
        listed.map(item => item._id),
        [older, newer, laterApproval, earlierApproval].map(item =>
          String(item._id),
        ),
      );
      const publicFields = ['_id', 'displayName', 'username'];
      for (const item of listed) {
        assert.deepEqual(Object.keys(item.requester).sort(), publicFields);
        assert.deepEqual(
          Object.keys(item.experience.userFrom).sort(),
          publicFields,
        );
        assert.deepEqual(
          Object.keys(item.experience.userTo).sort(),
          publicFields,
        );
      }
    });
  });

  describe('deciding requests', () => {
    const decide = (
      changeRequest: { _id: unknown },
      decision: string,
      user: Member = admin,
    ) =>
      call(controller.decide, {
        params: { id: String(changeRequest._id) },
        body: { decision },
        user,
      });

    const removal = (overrides: Record<string, unknown> = {}) =>
      ChangeRequest.create({
        experience: experience._id,
        requester: author._id,
        kind: 'remove',
        ...overrides,
      });

    it('explains invalid and stale decisions', async () => {
      const pending = await removal();
      const invalid = await decide(pending, 'maybe');
      assert.equal(invalid.statusCode, 400);
      assert.deepEqual(invalid.body, { message: 'Invalid review decision.' });
      // Another request being pending must not stand in for a missing one.
      const missing = await decide(
        { _id: new mongoose.Types.ObjectId() },
        'approve',
      );
      assert.equal(missing.statusCode, 409);
      assert.deepEqual(missing.body, {
        message: 'This request is no longer pending.',
      });
    });

    it('does not reject a request that is already being approved', async () => {
      const processing = await removal({
        status: 'processing',
        reviewedAt: new Date(),
        reviewedBy: support._id,
      });
      const result = await decide(processing, 'reject');
      assert.equal(result.statusCode, 409);
      assert.deepEqual(result.body, {
        message: 'This request is no longer pending.',
      });
    });

    it('does not reject a request another reviewer claimed after the checks', async () => {
      const pending = await removal();
      const findById = Experience.findById.bind(Experience);
      // The parties lookup runs between the pending check and the claim.
      sinon.stub(Experience, 'findById').callsFake((id: unknown) => {
        const query = findById(id);
        const exec = query.exec.bind(query);
        query.exec = async () => {
          await ChangeRequest.updateOne(
            { _id: pending._id },
            {
              $set: {
                status: 'processing',
                reviewedAt: new Date(),
                reviewedBy: support._id,
              },
            },
          );
          return exec();
        };
        return query;
      });
      const result = await decide(pending, 'reject');
      assert.equal(result.statusCode, 409);
      assert.deepEqual(result.body, {
        message: 'This request is no longer pending. Refresh the review queue.',
      });
      const stored = await ChangeRequest.findById(pending._id).lean<{
        status: string;
      }>();
      assert.equal(stored!.status, 'processing');
    });

    it('rejects a pending request', async () => {
      const pending = await removal();
      const result = await decide(pending, 'reject');
      assert.equal(result.statusCode, 200);
      assert.deepEqual(result.body, {
        _id: String(pending._id),
        status: 'rejected',
      });
      const stored = await ChangeRequest.findById(pending._id).lean<{
        status: string;
        active: boolean;
      }>();
      assert.equal(stored!.status, 'rejected');
      assert.equal(stored!.active, false);
    });

    it('approves a pending request', async () => {
      const pending = await removal();
      const result = await decide(pending, 'approve');
      assert.equal(result.statusCode, 200);
      assert.deepEqual(result.body, {
        _id: String(pending._id),
        status: 'approved',
      });
    });

    it('finishes a claimed approval without replacing its reviewer', async () => {
      const reviewedAt = new Date(Date.now() - 60_000);
      const processing = await removal({
        status: 'processing',
        reviewedAt,
        reviewedBy: support._id,
      });
      const result = await decide(processing, 'approve');
      assert.equal(result.statusCode, 200);
      const stored = await ChangeRequest.findById(processing._id).lean<{
        status: string;
        reviewedBy: Types.ObjectId;
        reviewedAt: Date;
      }>();
      assert.equal(stored!.status, 'approved');
      assert.equal(String(stored!.reviewedBy), String(support._id));
      assert.equal(stored!.reviewedAt.getTime(), reviewedAt.getTime());
    });

    it('returns an unavailable request to pending without touching others', async () => {
      const unrelated = await ChangeRequest.create({
        experience: (await createExperience(other, support))._id,
        requester: other._id,
        kind: 'remove',
        status: 'processing',
        reviewedAt: new Date(),
        reviewedBy: support._id,
      });
      await Experience.updateOne(
        { _id: experience._id },
        { $set: { removedAt: new Date(), removedBy: admin._id } },
      );
      const pending = await removal();
      const result = await decide(pending, 'approve');
      assert.equal(result.statusCode, 409);
      assert.deepEqual(result.body, {
        message:
          'This Experience is no longer available. Reject this request to close it.',
      });
      const stored = await ChangeRequest.findById(pending._id).lean<
        Record<string, unknown>
      >();
      assert.equal(stored!.status, 'pending');
      assert.equal('reviewedAt' in stored!, false);
      assert.equal('reviewedBy' in stored!, false);
      const untouched = await ChangeRequest.findById(unrelated._id).lean<{
        status: string;
      }>();
      assert.equal(untouched!.status, 'processing');
    });

    it('explains why a link issuer cannot approve', async () => {
      const pending = await removal({ linkIssuedBy: support._id });
      const result = await decide(pending, 'approve', support);
      assert.equal(result.statusCode, 403);
      assert.deepEqual(result.body, {
        message:
          'Approval requires another support team member or an administrator.',
      });
    });

    it('lets support decide on an Experience whose recipient is missing', async () => {
      const partial = await Experience.collection.insertOne({
        userFrom: other._id,
        public: true,
        created: new Date(),
      });
      const pending = await ChangeRequest.create({
        experience: partial.insertedId,
        requester: other._id,
        kind: 'remove',
      });
      const result = await decide(pending, 'reject', support);
      assert.equal(result.error, undefined);
      assert.equal(result.statusCode, 200);
    });
  });
});
