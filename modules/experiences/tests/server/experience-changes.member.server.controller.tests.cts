import type {
  ExperienceDocument,
  ExperienceModel,
  ExperienceRecord,
  UserDocument,
} from '../../../../testutils/server/model-contracts.mts';
const crypto: typeof import('crypto') = require('crypto');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const should: typeof import('should') = require('should');

const utils: typeof import('../../../../testutils/server/data.server.testutil') = require('../../../../testutils/server/data.server.testutil');
const memberChanges: typeof import('../../server/controllers/experience-changes.server.controller.mjs') = require('../../server/controllers/experience-changes.server.controller.mjs');

const Experience = mongoose.model<ExperienceRecord, ExperienceModel>(
  'Experience',
);
const ExperienceChangeLink = mongoose.model('ExperienceChangeLink');
const ExperienceChangeRequest = mongoose.model('ExperienceChangeRequest');

interface StoredChangeRequest {
  _id: unknown;
  kind: string;
  createdAt: Date;
  requester: unknown;
  linkIssuedBy: unknown;
  experience: unknown;
  proposed?: {
    feedbackPublic?: string;
    recommend?: string;
    interactions?: unknown;
  };
  original?: { feedbackPublic: string };
}

type MemberRequest = Parameters<typeof memberChanges.submit>[0];

interface Outcome {
  status: number | undefined;
  body: unknown;
  error: unknown;
  nextCalled: boolean;
}

const VALID_EDIT = {
  feedbackPublic: 'Changed text',
  recommend: 'no',
  interactions: { met: true, host: false, guest: true },
};

describe('Experience member change controller', () => {
  const users = utils.generateUsersWithSharedPassword(3, { public: true });
  let author: UserDocument;
  let recipient: UserDocument;
  let outsider: UserDocument;
  let experience: ExperienceDocument;
  const secret = 'a'.repeat(63) + 'b';

  const hash = (token: string) =>
    crypto.createHash('sha256').update(token).digest('hex');

  async function link(
    member: UserDocument,
    token = secret,
    expiresAt = new Date(Date.now() + 3600_000),
  ) {
    return ExperienceChangeLink.create({
      experience: experience._id,
      member: member._id,
      issuedBy: outsider._id,
      tokenHash: hash(token),
      expiresAt,
    });
  }

  async function call(
    handler: (
      request: MemberRequest,
      response: never,
      next: (error?: unknown) => void,
    ) => Promise<unknown>,
    member: UserDocument,
    options: {
      id?: string;
      body?: unknown;
      token?: string | undefined;
    } = {},
  ): Promise<Outcome> {
    const outcome: Outcome = {
      status: undefined,
      body: undefined,
      error: undefined,
      nextCalled: false,
    };
    const response = {
      status(code: number) {
        outcome.status = code;
        return response;
      },
      json(body: unknown) {
        outcome.body = body;
        return response;
      },
    };
    await handler(
      {
        params: { id: options.id ?? String(experience._id) },
        body: options.body,
        user: { _id: new mongoose.Types.ObjectId(String(member._id)) },
        get: () => ('token' in options ? options.token : secret),
      },
      response as never,
      error => {
        outcome.nextCalled = true;
        outcome.error = error;
      },
    );
    return outcome;
  }

  beforeEach(async () => {
    [author, recipient, outsider] =
      await utils.saveUsersWithCachedPasswords(users);
    experience = await Experience.create({
      userFrom: author._id,
      userTo: recipient._id,
      public: true,
      interactions: { met: true, host: false, guest: false },
      recommend: 'yes',
      feedbackPublic: 'Original text',
    });
  });

  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
  });

  describe('readAccess', () => {
    it('rejects an invalid Experience id', async () => {
      const out = await call(memberChanges.readAccess, author, { id: 'nope' });
      out.status!.should.equal(400);
      out.body!.should.deepEqual({ message: 'Invalid Experience identifier.' });
    });

    it('hides missing, removed and unrelated Experiences', async () => {
      await link(author);
      const missing = await call(memberChanges.readAccess, author, {
        id: String(new mongoose.Types.ObjectId()),
      });
      missing.status!.should.equal(404);
      missing.body!.should.deepEqual({ message: 'Experience not found.' });

      const unrelated = await call(memberChanges.readAccess, outsider);
      unrelated.status!.should.equal(404);
      unrelated.body!.should.deepEqual({ message: 'Experience not found.' });

      await Experience.updateOne(
        { _id: experience._id },
        { $set: { removedAt: new Date() } },
      );
      const removed = await call(memberChanges.readAccess, author);
      removed.status!.should.equal(404);
      removed.body!.should.deepEqual({ message: 'Experience not found.' });
    });

    it('lets the recipient see the Experience too', async () => {
      await link(recipient);
      const out = await call(memberChanges.readAccess, recipient);
      should(out.nextCalled).be.false();
      should(out.status).be.undefined();
      out.body!.should.deepEqual({
        _id: experience._id,
        public: true,
        canEdit: false,
        feedbackPublic: 'Original text',
        recommend: 'yes',
        interactions: { met: true, host: false, guest: false },
      });
    });

    it('returns an empty text when the Experience has none', async () => {
      await Experience.collection.updateOne(
        { _id: experience._id },
        { $unset: { feedbackPublic: '' } },
      );
      await link(author);
      const out = await call(memberChanges.readAccess, author);
      (out.body as { feedbackPublic: string }).feedbackPublic.should.equal('');
    });

    it('shows a private Experience content only to its author', async () => {
      await Experience.updateOne(
        { _id: experience._id },
        { $set: { public: false } },
      );
      await link(recipient);
      const asRecipient = await call(memberChanges.readAccess, recipient);
      asRecipient.body!.should.deepEqual({
        _id: experience._id,
        public: false,
        canEdit: false,
      });

      await ExperienceChangeLink.deleteMany();
      await link(author);
      const asAuthor = await call(memberChanges.readAccess, author);
      asAuthor.body!.should.deepEqual({
        _id: experience._id,
        public: false,
        canEdit: true,
        feedbackPublic: 'Original text',
        recommend: 'yes',
        interactions: { met: true, host: false, guest: false },
      });
    });

    it('requires a well-formed secret header that matches a live link', async () => {
      const expected = { message: 'This link is invalid or has expired.' };
      const malformed = [
        undefined,
        '',
        'invalid',
        'A'.repeat(64),
        `zz${secret}`,
        `${secret}zz`,
        secret.slice(1),
      ];
      for (const token of malformed) {
        if (token) await link(author, token);
        const out = await call(memberChanges.readAccess, author, { token });
        out.status!.should.equal(403, String(token));
        out.body!.should.deepEqual(expected);
        await ExperienceChangeLink.deleteMany();
      }

      await link(author, secret, new Date(Date.now() - 1000));
      const expired = await call(memberChanges.readAccess, author);
      expired.status!.should.equal(403);
      expired.body!.should.deepEqual(expected);
    });

    it('forwards unexpected failures to next', async () => {
      const failure = new Error('db down');
      sinon.stub(Experience, 'findById').throws(failure);
      const out = await call(memberChanges.readAccess, author);
      out.error!.should.equal(failure);
    });
  });

  describe('readMine', () => {
    it('validates the id and membership', async () => {
      const invalid = await call(memberChanges.readMine, author, {
        id: 'nope',
      });
      invalid.status!.should.equal(400);
      invalid.body!.should.deepEqual({
        message: 'Invalid Experience identifier.',
      });

      const hidden = await call(memberChanges.readMine, outsider);
      hidden.status!.should.equal(404);
      hidden.body!.should.deepEqual({ message: 'Experience not found.' });
    });

    it('returns null without a request', async () => {
      const out = await call(memberChanges.readMine, author);
      should(out.body).be.null();
    });

    it('returns the latest summary of the caller only', async () => {
      const older = await ExperienceChangeRequest.create({
        experience: experience._id,
        requester: author._id,
        kind: 'remove',
        status: 'rejected',
        active: false,
        createdAt: new Date('2024-01-01'),
        reviewedAt: new Date('2024-01-02'),
      });
      const newer = await ExperienceChangeRequest.create({
        experience: experience._id,
        requester: author._id,
        kind: 'edit',
        proposed: VALID_EDIT,
        status: 'approved',
        active: false,
        createdAt: new Date('2024-02-01'),
        reviewedAt: new Date('2024-02-02'),
      });
      await ExperienceChangeRequest.create({
        experience: experience._id,
        requester: recipient._id,
        kind: 'remove',
        status: 'pending',
        createdAt: new Date('2024-03-01'),
      });
      const otherExperience = await Experience.create({
        userFrom: author._id,
        userTo: outsider._id,
        public: true,
        interactions: { met: true, host: false, guest: false },
        recommend: 'yes',
      });
      await ExperienceChangeRequest.create({
        experience: otherExperience._id,
        requester: author._id,
        kind: 'remove',
        status: 'pending',
        createdAt: new Date('2024-04-01'),
      });
      should(older._id).not.equal(newer._id);

      // Without the compound index the order must come from the query itself.
      await ExperienceChangeRequest.collection.dropIndex(
        'requester_1_experience_1_createdAt_-1',
      );
      let mine: Outcome;
      try {
        mine = await call(memberChanges.readMine, author);
      } finally {
        await ExperienceChangeRequest.createIndexes();
      }
      mine.body!.should.deepEqual({
        _id: newer._id,
        kind: 'edit',
        status: 'approved',
        createdAt: new Date('2024-02-01'),
        reviewedAt: new Date('2024-02-02'),
      });

      const theirs = await call(memberChanges.readMine, recipient);
      (theirs.body as { kind: string }).kind.should.equal('remove');
      (theirs.body as { status: string }).status.should.equal('pending');
    });

    it('still reports requests for removed Experiences', async () => {
      const request = await ExperienceChangeRequest.create({
        experience: experience._id,
        requester: author._id,
        kind: 'remove',
        status: 'approved',
        active: false,
      });
      await Experience.updateOne(
        { _id: experience._id },
        { $set: { removedAt: new Date() } },
      );
      const out = await call(memberChanges.readMine, author);
      should(out.status).be.undefined();
      (out.body as { _id: unknown })._id!.should.deepEqual(request._id);
    });

    it('forwards unexpected failures to next', async () => {
      const failure = new Error('db down');
      sinon.stub(Experience, 'findById').throws(failure);
      const out = await call(memberChanges.readMine, author);
      out.error!.should.equal(failure);
    });
  });

  describe('submit', () => {
    it('rejects invalid ids, strangers and invalid links', async () => {
      const invalid = await call(memberChanges.submit, author, { id: 'nope' });
      invalid.status!.should.equal(400);
      invalid.body!.should.deepEqual({
        message: 'Invalid Experience identifier.',
      });

      const stranger = await call(memberChanges.submit, outsider, {
        body: { kind: 'remove' },
      });
      stranger.status!.should.equal(404);
      stranger.body!.should.deepEqual({ message: 'Experience not found.' });

      const noLink = await call(memberChanges.submit, author, {
        body: { kind: 'remove' },
      });
      noLink.status!.should.equal(403);
      noLink.body!.should.deepEqual({
        message: 'This link is invalid or has expired.',
      });
    });

    it('rejects an unknown request type', async () => {
      await link(author);
      for (const body of [{}, { kind: 'invalid' }, { kind: 1 }]) {
        const out = await call(memberChanges.submit, author, { body });
        out.status!.should.equal(400);
        out.body!.should.deepEqual({ message: 'Invalid request type.' });
      }
    });

    it('reports a null body as a TypeError naming the missing field', async () => {
      await link(author);
      const out = await call(memberChanges.submit, author, { body: null });
      (out.error as Error).should.be.instanceof(TypeError);
      (out.error as Error).message.should.equal(
        "Cannot read properties of null (reading 'kind')",
      );
      const missing = await call(memberChanges.submit, author, {
        body: undefined,
      });
      (missing.error as Error).message.should.equal(
        "Cannot read properties of undefined (reading 'kind')",
      );
    });

    it('lets only the author propose an edit', async () => {
      await link(recipient);
      const out = await call(memberChanges.submit, recipient, {
        body: { kind: 'edit', proposed: VALID_EDIT },
      });
      out.status!.should.equal(403);
      out.body!.should.deepEqual({
        message: 'Only the author can propose an edit.',
      });
      (await ExperienceChangeRequest.countDocuments()).should.equal(0);
    });

    it('stores a valid edit with the original and the link issuer', async () => {
      await link(author);
      const out = await call(memberChanges.submit, author, {
        body: { kind: 'edit', proposed: VALID_EDIT },
      });
      out.status!.should.equal(201);
      const stored =
        await ExperienceChangeRequest.findOne().lean<StoredChangeRequest>();
      out.body!.should.deepEqual({
        _id: stored!._id,
        kind: 'edit',
        status: 'pending',
        createdAt: stored!.createdAt,
      });
      should(stored!.requester).deepEqual(author._id);
      should(stored!.linkIssuedBy).deepEqual(outsider._id);
      should(stored!.experience).deepEqual(experience._id);
      should(stored!.proposed).deepEqual(VALID_EDIT);
      should(stored!.original).deepEqual({
        feedbackPublic: 'Original text',
        recommend: 'yes',
        interactions: { met: true, host: false, guest: false },
      });
    });

    it('cleans the proposed text and stores an empty original text', async () => {
      await Experience.collection.updateOne(
        { _id: experience._id },
        { $unset: { feedbackPublic: '' } },
      );
      await link(author);
      const out = await call(memberChanges.submit, author, {
        body: {
          kind: 'edit',
          proposed: { ...VALID_EDIT, feedbackPublic: '<b>Bold</b> words' },
        },
      });
      out.status!.should.equal(201);
      const stored =
        await ExperienceChangeRequest.findOne().lean<StoredChangeRequest>();
      stored!.original!.feedbackPublic.should.equal('');
      stored!.proposed!.feedbackPublic!.should.equal('Bold words');
    });

    it('rejects malformed edits', async () => {
      await link(author);
      const base = { kind: 'edit', proposed: VALID_EDIT };
      const bodies: unknown[] = [
        { kind: 'edit' },
        { ...base, extra: true },
        { ...base, proposed: { ...VALID_EDIT, extra: true } },
        { ...base, proposed: { ...VALID_EDIT, feedbackPublic: 5 } },
        { ...base, proposed: { ...VALID_EDIT, recommend: 'maybe' } },
        { ...base, proposed: { ...VALID_EDIT, recommend: undefined } },
        { ...base, proposed: { ...VALID_EDIT, interactions: undefined } },
        {
          ...base,
          proposed: {
            ...VALID_EDIT,
            interactions: { ...VALID_EDIT.interactions, extra: true },
          },
        },
        {
          ...base,
          proposed: {
            ...VALID_EDIT,
            interactions: { met: 1, host: false, guest: false },
          },
        },
        {
          ...base,
          proposed: {
            ...VALID_EDIT,
            interactions: { met: false, host: 'no', guest: false },
          },
        },
        {
          ...base,
          proposed: {
            ...VALID_EDIT,
            interactions: { met: false, host: false, guest: 0 },
          },
        },
        {
          ...base,
          proposed: {
            ...VALID_EDIT,
            interactions: { met: false, host: false, guest: false },
          },
        },
        {
          ...base,
          proposed: { ...VALID_EDIT, feedbackPublic: 'x'.repeat(2001) },
        },
      ];
      for (const body of bodies) {
        const out = await call(memberChanges.submit, author, { body });
        out.status!.should.equal(400, JSON.stringify(body));
        out.body!.should.deepEqual({ message: 'Invalid change request.' });
      }
      (await ExperienceChangeRequest.countDocuments()).should.equal(0);
    });

    it('accepts every recommendation and a single interaction flag', async () => {
      for (const recommend of ['yes', 'no', 'unknown']) {
        for (const only of ['met', 'guest', 'host']) {
          await link(author);
          const interactions = { met: false, guest: false, host: false };
          Object.assign(interactions, { [only]: true });
          const out = await call(memberChanges.submit, author, {
            body: {
              kind: 'edit',
              proposed: { ...VALID_EDIT, recommend, interactions },
            },
          });
          out.status!.should.equal(201, `${recommend} ${only}`);
          const stored =
            await ExperienceChangeRequest.findOne().lean<StoredChangeRequest>();
          should(stored!.proposed!.recommend).equal(recommend);
          should(stored!.proposed!.interactions).deepEqual(interactions);
          await ExperienceChangeRequest.deleteMany();
          await ExperienceChangeLink.deleteMany();
        }
      }
    });

    it('accepts text at the length limit and rejects one more', async () => {
      const limit = 2000;
      await link(author);
      const atLimit = await call(memberChanges.submit, author, {
        body: {
          kind: 'edit',
          proposed: { ...VALID_EDIT, feedbackPublic: 'x'.repeat(limit) },
        },
      });
      atLimit.status!.should.equal(201);
      await ExperienceChangeRequest.deleteMany();
      const over = await call(memberChanges.submit, author, {
        body: {
          kind: 'edit',
          proposed: { ...VALID_EDIT, feedbackPublic: 'x'.repeat(limit + 1) },
        },
      });
      over.status!.should.equal(400);
    });

    it('stores a removal and rejects extra fields on it', async () => {
      await link(recipient);
      for (const body of [
        { kind: 'remove', proposed: {} },
        { kind: 'remove', extra: 1 },
      ]) {
        const out = await call(memberChanges.submit, recipient, { body });
        out.status!.should.equal(400);
        out.body!.should.deepEqual({ message: 'Invalid change request.' });
      }
      const ok = await call(memberChanges.submit, recipient, {
        body: { kind: 'remove' },
      });
      ok.status!.should.equal(201);
      const stored =
        await ExperienceChangeRequest.findOne().lean<StoredChangeRequest>();
      should(stored!.kind).equal('remove');
      should(stored!.requester).deepEqual(recipient._id);
      should(stored!.proposed?.feedbackPublic).be.undefined();
    });

    it('blocks a second open request but not after a decision', async () => {
      await link(author);
      for (const status of ['pending', 'processing']) {
        const existing = await ExperienceChangeRequest.create({
          experience: experience._id,
          requester: recipient._id,
          kind: 'remove',
          status,
        });
        const out = await call(memberChanges.submit, author, {
          body: { kind: 'remove' },
        });
        out.status!.should.equal(409, status);
        out.body!.should.deepEqual({
          message: 'An Experience change is already pending.',
        });
        await ExperienceChangeRequest.deleteOne({ _id: existing._id });
      }
      for (const status of ['pending', 'processing']) {
        // Legacy open requests are not covered by the unique active index.
        const legacy = await ExperienceChangeRequest.create({
          experience: experience._id,
          requester: recipient._id,
          kind: 'remove',
          status,
          active: false,
        });
        const out = await call(memberChanges.submit, author, {
          body: { kind: 'remove' },
        });
        out.status!.should.equal(409, `inactive ${status}`);
        await ExperienceChangeRequest.deleteOne({ _id: legacy._id });
      }
      for (const status of ['approved', 'rejected']) {
        await ExperienceChangeRequest.create({
          experience: experience._id,
          requester: recipient._id,
          kind: 'remove',
          status,
          active: false,
        });
      }
      const out = await call(memberChanges.submit, author, {
        body: { kind: 'remove' },
      });
      out.status!.should.equal(201);
    });

    it('reports a lost race on the unique index as a conflict', async () => {
      await link(author);
      for (const rejection of [
        { code: 11000 },
        Object.assign(() => undefined, { code: 11000 }),
      ]) {
        sinon.stub(ExperienceChangeRequest, 'create').rejects(rejection);
        const out = await call(memberChanges.submit, author, {
          body: { kind: 'remove' },
        });
        out.status!.should.equal(409);
        out.body!.should.deepEqual({
          message: 'An Experience change is already pending.',
        });
        sinon.restore();
      }
    });

    it('forwards other rejections to next', async () => {
      await link(author);
      for (const rejection of [{ code: 1 }, 'plain', 11000]) {
        sinon
          .stub(ExperienceChangeRequest, 'create')
          .callsFake(() => Promise.reject(rejection));
        const out = await call(memberChanges.submit, author, {
          body: { kind: 'remove' },
        });
        out.nextCalled.should.be.true();
        should(out.error).equal(rejection);
        should(out.status).be.undefined();
        sinon.restore();
      }
    });

    it('names the rejected value when it is nullish', async () => {
      await link(author);
      for (const rejection of [null, undefined]) {
        sinon
          .stub(ExperienceChangeRequest, 'create')
          .callsFake(() => Promise.reject(rejection));
        let thrown: unknown;
        try {
          await call(memberChanges.submit, author, {
            body: { kind: 'remove' },
          });
        } catch (error) {
          thrown = error;
        }
        (thrown as Error).message.should.equal(
          `Cannot read properties of ${rejection} (reading 'code')`,
        );
        sinon.restore();
      }
    });
  });
});
