/**
 * Unit tests for the admin support controller, run against the test database.
 */
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const should: typeof import('should') = require('should');
const config: typeof import('../../../../config/config.mts').default = require('../../../../config/config.mts');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const controller: typeof import('../../server/controllers/admin.support.server.controller.mts') = require('../../server/controllers/admin.support.server.controller.mts');

type StoredRecord = Record<string, unknown>;
type StoredRequest = {
  status: string;
  resolvedAt: Date | null;
  resolvedBy: unknown;
  statusChangedAt: Date;
  statusRevision: number;
};
type StoredAudit = { query?: StoredRecord; body?: StoredRecord };
type StoredMember = { roles: string[] };

const SupportRequest = mongoose.model('SupportRequest');
const SupportMessage = mongoose.model('SupportMessage');
const User = mongoose.model('User');
const Message = mongoose.model('Message');
const Experience = mongoose.model('Experience');
const AuditLog = mongoose.model('AuditLog');

async function storedRequest(id: unknown): Promise<StoredRequest> {
  return (await SupportRequest.findById(id).lean()) as unknown as StoredRequest;
}

type Action = typeof controller.list;
type ActionRequest = Parameters<Action>[0];
type MockResponse = {
  statusCode: number;
  body: unknown;
  status(code: number): MockResponse;
  send(body: unknown): MockResponse;
  json(body: unknown): MockResponse;
};
type RequestInput = {
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: unknown;
  route?: { path: string };
};
type ListItem = Record<string, unknown> & { _id: string; status: string };
type ListBody = {
  items: ListItem[];
  page: number;
  hasMore: boolean;
  total: number;
  matchingTotal: number;
};
type PagedBody = {
  items: Array<Record<string, unknown> & { _id: string; createdAt?: string }>;
  page: number;
  hasMore: boolean;
};
type MemberBody = Record<string, unknown> & { username: string };

const staff = {
  _id: new mongoose.Types.ObjectId(),
  username: 'fictional-staff',
};

function mockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: undefined,
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(body) {
      res.body = body;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

async function call(
  action: Action,
  input: RequestInput = {},
): Promise<MockResponse> {
  const res = mockResponse();
  await action(
    {
      params: {},
      query: {},
      body: {},
      route: { path: '/api/admin/support/test' },
      user: staff,
      ...input,
    } as unknown as ActionRequest,
    res,
  );
  return res;
}

function plain<T>(res: MockResponse): T {
  return JSON.parse(JSON.stringify(res.body)) as T;
}

function expectError(res: MockResponse, status: number, message: string) {
  res.statusCode.should.equal(status);
  should(res.body).deepEqual({ message });
}

function hexId(): string {
  return new mongoose.Types.ObjectId().toHexString();
}

let messageSequence = 0;
function supportMessage(
  request: unknown,
  createdAt: Date,
  body = 'Fictional reply',
) {
  messageSequence += 1;
  return {
    request,
    direction: 'outbound',
    kind: 'reply',
    body,
    createdAt,
    deliveryState: 'accepted',
    messageId: `<fictional-${messageSequence}-${hexId()}@example.test>`,
  };
}

async function listIds(query: Record<string, unknown>): Promise<string[]> {
  const res = await call(controller.list, {
    query: { status: 'all', ...query },
  });
  res.statusCode.should.equal(200);
  return plain<ListBody>(res).items.map(item => item._id);
}

function stubFailingTextSearch(): void {
  const originalFind = User.find;
  sinon.stub(User, 'find').callsFake(function (
    this: typeof User,
    ...args: Parameters<typeof User.find>
  ) {
    const criteria = args[0];
    if (
      typeof criteria === 'object' &&
      criteria !== null &&
      '$text' in criteria
    ) {
      const failing = {
        select: () => failing,
        sort: () => failing,
        limit: () => failing,
        lean: () => Promise.reject(new Error('text index unavailable')),
      };
      return failing as unknown as ReturnType<typeof User.find>;
    }
    return originalFind.apply(this, args);
  });
}

describe('Admin support controller unit tests', () => {
  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
  });

  describe('validation and errors', () => {
    it('validates page numbers', async () => {
      expectError(
        await call(controller.list, { query: { page: '01' } }),
        400,
        'Invalid page.',
      );
      const res = await call(controller.list, { query: { page: '12' } });
      res.statusCode.should.equal(200);
      plain<ListBody>(res).page.should.equal(12);
    });

    it('validates request ids and reports missing requests', async () => {
      for (const requestId of [
        `z${hexId()}`,
        `${hexId()}z`,
        new mongoose.Types.ObjectId(),
      ]) {
        expectError(
          await call(controller.detail, { params: { requestId } }),
          400,
          'Invalid ID.',
        );
      }
      expectError(
        await call(controller.detail, { params: { requestId: hexId() } }),
        404,
        'Support request not found.',
      );
    });

    it('limits searches to 200 characters', async () => {
      (
        await call(controller.list, { query: { q: 'x'.repeat(200) } })
      ).statusCode.should.equal(200);
      expectError(
        await call(controller.list, { query: { q: 'x'.repeat(201) } }),
        400,
        'Invalid support filters.',
      );
    });

    it('hides unexpected errors behind a generic message', async () => {
      sinon.stub(SupportRequest, 'findById').throws(new Error('db down'));
      expectError(
        await call(controller.detail, { params: { requestId: hexId() } }),
        500,
        'Unable to load support information.',
      );
    });
  });

  describe('audit log', () => {
    it('records only the given filters, whether a search was made and the status change', async () => {
      const report = await SupportRequest.create({ message: 'Fictional' });
      await call(controller.list, {
        query: { status: 'all', page: '1', q: 'secret words', extra: 'x' },
        route: { path: '/api/admin/support' },
      });
      await call(controller.list, {
        query: { category: 'account' },
        route: { path: '/api/admin/support' },
      });
      await call(controller.setStatus, {
        params: { requestId: String(report._id) },
        body: { status: 'open', note: 'Private note' },
        route: { path: '/api/admin/support/:requestId' },
      });
      const audits = (await AuditLog.find({ user: staff._id })
        .sort({ _id: 1 })
        .lean()) as unknown as StoredAudit[];
      audits
        .map(item => item.query)
        .should.deepEqual([
          { status: 'all', page: '1', hasSearch: true },
          { category: 'account' },
          undefined,
        ]);
      should(audits[2].body).deepEqual({ status: 'open' });
    });
  });

  describe('list', () => {
    it('searches subjects, messages, usernames, emails, replies, ids and ticket numbers literally', async () => {
      const [subject, message, username, email, ticket, replied, byId] =
        await SupportRequest.create([
          { subject: 'Fictional alpha subject', message: 'one' },
          { message: 'Fictional bravo message' },
          { username: 'fictional-charlie', message: 'three' },
          { email: 'delta-member@example.test', message: 'four' },
          { message: 'five', zendeskTicketId: 1000 },
          { message: 'six' },
          { message: 'seven' },
        ]);
      await SupportMessage.insertMany([
        supportMessage(replied._id, new Date(), 'An echo in a reply'),
        supportMessage(byId._id, new Date(), 'Another fictional reply'),
      ]);
      await SupportRequest.collection.insertOne({
        status: 'new',
        sent: new Date(),
      });

      (await listIds({ q: 'alpha' })).should.deepEqual([String(subject._id)]);
      (await listIds({ q: '  bravo  ' })).should.deepEqual([
        String(message._id),
      ]);
      (await listIds({ q: 'charlie' })).should.deepEqual([
        String(username._id),
      ]);
      (await listIds({ q: 'delta-member' })).should.deepEqual([
        String(email._id),
      ]);
      (await listIds({ q: 'echo' })).should.deepEqual([String(replied._id)]);
      (await listIds({ q: String(byId._id) })).should.deepEqual([
        String(byId._id),
      ]);
      (await listIds({ q: '1000' })).should.deepEqual([String(ticket._id)]);
      (await listIds({ q: '1e3' })).should.deepEqual([]);
      (await listIds({ q: `z${byId._id}` })).should.deepEqual([]);
      (await listIds({ q: `${byId._id}z` })).should.deepEqual([]);
      (await listIds({ q: '   ' })).length.should.equal(8);
    });

    it('orders by latest activity then newest id and returns only list fields', async () => {
      const a = await SupportRequest.create({
        message: 'a',
        sent: new Date('2026-01-01T00:00:00Z'),
        lastActivityAt: new Date('2026-03-01T00:00:00Z'),
        status: 'resolved',
      });
      const b = await SupportRequest.create({
        message: 'b',
        sent: new Date('2026-02-01T00:00:00Z'),
      });
      const c = await SupportRequest.create({
        message: 'c',
        sent: new Date('2026-01-15T00:00:00Z'),
        status: 'hold',
      });
      const d = await SupportRequest.create({
        message: 'd',
        sent: new Date('2026-01-15T00:00:00Z'),
        status: 'pending',
      });

      const res = await call(controller.list, { query: { status: 'all' } });
      const { items } = plain<ListBody>(res);
      items
        .map(item => [item._id, item.status])
        .should.deepEqual([
          [String(a._id), 'solved'],
          [String(b._id), 'new'],
          [String(d._id), 'pending'],
          [String(c._id), 'hold'],
        ]);
      Object.keys(items[0])
        .sort()
        .should.deepEqual([
          '_id',
          'category',
          'lastActivityAt',
          'sent',
          'status',
          'statusProvenance',
        ]);
    });

    it('lists only explicitly open requests as open and missing statuses as unconfirmed', async () => {
      const open = await SupportRequest.create({
        message: 'open',
        status: 'open',
      });
      const legacy = await SupportRequest.collection.insertOne({
        message: 'legacy',
        sent: new Date(),
      });
      await SupportRequest.create({ message: 'new' });

      (await listIds({ status: 'open' })).should.deepEqual([String(open._id)]);
      (await listIds({ status: 'unconfirmed' })).should.deepEqual([
        String(legacy.insertedId),
      ]);
    });

    it('reports whether more pages follow', async () => {
      await SupportRequest.insertMany(
        Array.from({ length: 50 }, (_, index) => ({ message: `r${index}` })),
      );
      const full = plain<ListBody>(
        await call(controller.list, { query: { status: 'all' } }),
      );
      full.matchingTotal.should.equal(50);
      full.hasMore.should.equal(false);

      await SupportRequest.create({ message: 'one more' });
      plain<ListBody>(
        await call(controller.list, { query: { status: 'all' } }),
      ).hasMore.should.equal(true);
      const second = plain<ListBody>(
        await call(controller.list, { query: { status: 'all', page: 2 } }),
      );
      second.items.length.should.equal(1);
      second.hasMore.should.equal(false);
    });
  });

  describe('detail', () => {
    it('returns the request fields with their status provenance', async () => {
      const report = await SupportRequest.create({
        message: 'Fictional request',
        status: 'resolved',
        userAgent: 'Fictional agent',
        initialMessageId: '<fictional@example.test>',
      });
      const res = await call(controller.detail, {
        params: { requestId: String(report._id) },
      });
      const body = plain<Record<string, unknown>>(res);
      body.status!.should.equal('solved');
      body.statusProvenance!.should.equal('explicit');
      Object.keys(body)
        .sort()
        .should.deepEqual([
          '_id',
          'category',
          'initialAttachments',
          'message',
          'oversized',
          'sent',
          'status',
          'statusProvenance',
          'statusRevision',
          'truncated',
        ]);

      for (const status of [undefined, null]) {
        const { insertedId } = await SupportRequest.collection.insertOne({
          message: 'Legacy',
          ...(status === null ? { status } : {}),
        });
        const legacy = plain<Record<string, unknown>>(
          await call(controller.detail, {
            params: { requestId: String(insertedId) },
          }),
        );
        legacy.status!.should.equal('open');
        legacy.statusProvenance!.should.equal('missing');
      }
    });
  });

  describe('setStatus', () => {
    it('records who resolved a request and when, and clears it on reopening', async () => {
      const [other, report] = await SupportRequest.create([
        { message: 'other' },
        { message: 'target' },
      ]);
      const setStatus = (status: string) =>
        call(controller.setStatus, {
          params: { requestId: String(report._id) },
          body: { status },
        });

      for (const status of ['closed', 'solved']) {
        const res = await setStatus(status);
        should(res.body).deepEqual({ status });
        const saved = await storedRequest(report._id);
        saved.status.should.equal(status);
        should(saved.resolvedAt).be.instanceOf(Date);
        String(saved.resolvedBy).should.equal(String(staff._id));
        saved.statusChangedAt.should.be.instanceOf(Date);
      }
      await setStatus('open');
      const reopened = await storedRequest(report._id);
      should(reopened.resolvedAt).be.null();
      should(reopened.resolvedBy).be.null();
      reopened.statusRevision.should.equal(3);

      await setStatus('resolved');
      (await storedRequest(report._id)).status.should.equal('solved');
      const untouched = await storedRequest(other._id);
      untouched.status.should.equal('new');
      untouched.statusRevision.should.equal(0);
    });

    it('rejects missing and unknown statuses', async () => {
      const report = await SupportRequest.create({ message: 'target' });
      for (const body of [undefined, { status: 'bogus' }]) {
        expectError(
          await call(controller.setStatus, {
            params: { requestId: String(report._id) },
            body,
          }),
          400,
          'Invalid status.',
        );
      }
    });

    it('refuses to overwrite a request that changed while it was updated', async () => {
      const report = await SupportRequest.create({
        message: 'target',
        statusRevision: 3,
      });
      const { insertedId: legacyId } =
        await SupportRequest.collection.insertOne({
          message: 'legacy',
          status: 'new',
        });
      const legacyUnchanged = await SupportRequest.collection.insertOne({
        message: 'legacy unchanged',
        status: 'new',
      });

      (
        await call(controller.setStatus, {
          params: { requestId: String(legacyUnchanged.insertedId) },
          body: { status: 'pending' },
        })
      ).statusCode.should.equal(200);
      (
        await storedRequest(legacyUnchanged.insertedId)
      ).statusRevision!.should.equal(1);

      const save = AuditLog.prototype.save;
      const concurrentChanges: Record<string, unknown> = {
        [String(report._id)]: 4,
        [String(legacyId)]: null,
      };
      sinon.stub(AuditLog.prototype, 'save').callsFake(async function (
        this: InstanceType<typeof AuditLog>,
      ) {
        const requestId = (
          (this as unknown as { params: unknown }).params as {
            requestId: string;
          }
        ).requestId;
        await SupportRequest.collection.updateOne(
          { _id: new mongoose.Types.ObjectId(requestId) },
          { $set: { statusRevision: concurrentChanges[requestId] } },
        );
        return save.call(this);
      });

      for (const requestId of [report._id, legacyId]) {
        expectError(
          await call(controller.setStatus, {
            params: { requestId: String(requestId) },
            body: { status: 'closed' },
          }),
          409,
          'This request changed. Reload before updating it.',
        );
        (await storedRequest(requestId)).status.should.equal('new');
      }
    });
  });

  describe('conversation', () => {
    it('pages the conversation of one request, oldest first, after the initial message', async () => {
      const [report, busy] = await SupportRequest.create([
        {
          message: 'Initial fictional request',
          username: 'fictional-requester',
          sent: new Date('2026-01-01T00:00:00Z'),
          initialAttachments: [
            { filename: 'a.txt', contentType: 'text/plain', size: 3 },
          ],
          oversized: true,
        },
        { message: 'Busy request', email: 'busy@example.test' },
      ]);
      const day = (offset: number) =>
        new Date(Date.UTC(2026, 1, 1) + offset * 86_400_000);
      await SupportMessage.insertMany([
        // Inserted newest first, so the natural order is not the page order.
        ...Array.from({ length: 49 }, (_, index) =>
          supportMessage(report._id, day(200 - index)),
        ),
        ...Array.from({ length: 100 }, (_, index) =>
          supportMessage(busy._id, day(100 - index)),
        ),
      ]);

      const first = plain<PagedBody>(
        await call(controller.conversation, {
          params: { requestId: String(report._id) },
        }),
      );
      first.items.length.should.equal(50);
      first.hasMore.should.equal(false);
      const { attachments, ...initial } = first.items[0];
      should(initial).deepEqual({
        _id: `initial-${report._id}`,
        request: String(report._id),
        kind: 'initial',
        direction: 'inbound',
        body: 'Initial fictional request',
        createdAt: '2026-01-01T00:00:00.000Z',
        authorName: 'fictional-requester',
        deliveryState: 'received',
        oversized: true,
        truncated: false,
      });
      (attachments as Array<{ filename: string }>)
        .map(item => item.filename)
        .should.deepEqual(['a.txt']);
      const replies = first.items.slice(1);
      replies
        .every(item => item.request === String(report._id))
        .should.equal(true);
      replies
        .map(item => item.createdAt)
        .should.deepEqual(
          Array.from({ length: 49 }, (_, index) =>
            day(152 + index).toISOString(),
          ),
        );
      Object.keys(replies[0])
        .sort()
        .should.deepEqual([
          '_id',
          'attachments',
          'body',
          'createdAt',
          'deliveryState',
          'direction',
          'kind',
          'oversized',
          'request',
          'truncated',
        ]);

      const second = plain<PagedBody>(
        await call(controller.conversation, {
          params: { requestId: String(busy._id) },
          query: { page: 2 },
        }),
      );
      second.items.length.should.equal(50);
      second.items[0].createdAt!.should.equal(day(50).toISOString());
      second.hasMore.should.equal(true);
    });
  });

  describe('replies', () => {
    it('passes missing reply input on to the support inbox validation', async () => {
      sinon
        .stub(config, 'supportInbox')
        .value({ ...config.supportInbox, enabled: true });
      const report = await SupportRequest.create({
        message: 'Fictional',
        email: 'requester@example.test',
      });
      expectError(
        await call(controller.reply, {
          params: { requestId: String(report._id) },
          body: undefined,
        }),
        400,
        'Reply body must be text',
      );
      expectError(
        await call(controller.retry, {
          params: { requestId: String(report._id), messageId: hexId() },
          body: undefined,
        }),
        400,
        'An idempotency key is required',
      );
    });
  });

  describe('investigation', () => {
    it('only investigates member reports about another member', async () => {
      const [reporter, reported] = [
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
      ];
      const account = await SupportRequest.create({
        category: 'account',
        message: 'Fictional',
        user: reporter,
        reportedUser: reported,
      });
      expectError(
        await call(controller.investigation, {
          params: { requestId: String(account._id), kind: 'messages' },
        }),
        403,
        'This report has no verified member pair.',
      );
      const report = await SupportRequest.create({
        category: 'reportMember',
        message: 'Fictional',
        user: reporter,
        reportedUser: reported,
      });
      expectError(
        await call(controller.investigation, {
          params: { requestId: String(report._id), kind: 'notes' },
        }),
        400,
        'Invalid investigation type.',
      );
    });

    it('lists messages and experiences between the pair with investigation fields only', async () => {
      const [reporter, reported, bystander] =
        await utils.saveUsersWithCachedPasswords(
          utils.generateUsersWithSharedPassword(3),
        );
      const report = await SupportRequest.create({
        category: 'reportMember',
        message: 'Fictional',
        user: reporter._id,
        reportedUser: reported._id,
      });
      await Message.insertMany([
        ...Array.from({ length: 50 }, (_, index) => ({
          content: `Message ${index}`,
          userFrom: index % 2 ? reporter._id : reported._id,
          userTo: index % 2 ? reported._id : reporter._id,
        })),
        {
          content: 'Unrelated',
          userFrom: reported._id,
          userTo: bystander._id,
        },
      ]);
      await Experience.create({
        userFrom: reported._id,
        userTo: reporter._id,
        feedbackPublic: 'Fictional feedback',
        removedAt: new Date(),
      });
      const investigate = async (kind: string) =>
        plain<PagedBody>(
          await call(controller.investigation, {
            params: { requestId: String(report._id), kind },
          }),
        );

      const messages = await investigate('messages');
      messages.items.length.should.equal(50);
      messages.hasMore.should.equal(false);
      Object.keys(messages.items[0])
        .sort()
        .should.deepEqual([
          '_id',
          'content',
          'created',
          'shadowHidden',
          'userFrom',
          'userTo',
        ]);
      Object.keys(messages.items[0].userFrom as object)
        .sort()
        .should.deepEqual(['_id', 'displayName', 'username']);

      await Message.create({
        content: 'One more',
        userFrom: reporter._id,
        userTo: reported._id,
      });
      const more = await investigate('messages');
      more.items.length.should.equal(50);
      more.hasMore.should.equal(true);

      const experiences = await investigate('experiences');
      experiences.items.length.should.equal(1);
      Object.keys(experiences.items[0])
        .sort()
        .should.deepEqual([
          '_id',
          'created',
          'feedbackPublic',
          'interactions',
          'public',
          'recommend',
          'userFrom',
          'userTo',
        ]);
    });
  });

  describe('member search', () => {
    function rawMember(username: string, extra: Record<string, unknown> = {}) {
      return {
        username,
        email: `${username}@example.test`,
        displayName: 'Fictional Member',
        roles: ['user'],
        public: true,
        password: 'fictional-hash',
        salt: 'fictional-salt',
        emailToken: 'fictional-token',
        ...extra,
      };
    }

    async function search(term: unknown): Promise<MockResponse> {
      return call(controller.searchMembers, { query: { search: term } });
    }

    async function searchNames(term: string): Promise<string[]> {
      const res = await search(term);
      res.statusCode.should.equal(200);
      return plain<MemberBody[]>(res).map(item => item.username);
    }

    it('validates the search term', async () => {
      for (const term of [['abcd'], '  ab  ', 'x'.repeat(255)]) {
        expectError(
          await search(term),
          400,
          'Enter at least three characters.',
        );
      }
      (await search('abc')).statusCode.should.equal(200);
      (await search('x'.repeat(254))).statusCode.should.equal(200);
    });

    it('matches username and email prefixes literally and case-insensitively', async () => {
      await User.collection.insertMany([
        rawMember('fictional-dot-y', { email: 'abcd@example.test' }),
        rawMember('fictional-dot-x', {
          email: 'ab.cd@example.test',
          removeProfileToken: 'fictional-removal',
        }),
      ]);

      (await searchNames('AB.CD')).should.deepEqual(['fictional-dot-x']);
      (await searchNames('  ab.cd  ')).should.deepEqual(['fictional-dot-x']);
      (await searchNames('fictional-dot')).should.deepEqual([
        'fictional-dot-x',
        'fictional-dot-y',
      ]);

      const [member] = plain<MemberBody[]>(await search('ab.cd'));
      member.pendingDeletion!.should.equal(true);
      Object.keys(member)
        .sort()
        .should.deepEqual([
          '_id',
          'displayName',
          'email',
          'pendingDeletion',
          'public',
          'roles',
          'username',
        ]);
    });

    it('adds text matches by relevance after indexed matches, up to one page', async () => {
      await User.collection.insertMany([
        rawMember('fictional-b', {
          tagline: 'zebrafish and a long tagline with many other words in it',
        }),
        rawMember('fictional-a', {
          tagline: 'zebrafish zebrafish zebrafish',
        }),
      ]);
      (await searchNames('zebrafish')).should.deepEqual([
        'fictional-a',
        'fictional-b',
      ]);

      await User.collection.insertMany([
        ...Array.from({ length: 49 }, (_, index) =>
          rawMember(`slicefix${index}`),
        ),
        rawMember('fictional-c', { tagline: 'slicefix' }),
        rawMember('fictional-d', { tagline: 'slicefix' }),
      ]);
      const names = await searchNames('slicefix');
      names.length.should.equal(50);
      names
        .slice(0, 49)
        .every(name => name.startsWith('slicefix'))
        .should.be.true();
    });

    it('falls back to case-insensitive name patterns without text search', async () => {
      stubFailingTextSearch();
      await User.collection.insertMany([
        rawMember('fallback-c', { lastName: 'Ada Lovelace-Byron' }),
        rawMember('fallback-a', { displayName: 'Ada  Lovelace' }),
        rawMember('fallback-d', { displayName: 'Grace Hopper' }),
        rawMember('fallback-b', { firstName: 'ada lovelace' }),
      ]);
      (await searchNames('ada lovelace')).should.deepEqual([
        'fallback-a',
        'fallback-b',
        'fallback-c',
      ]);
    });

    it('reports members that are not found by username or id', async () => {
      for (const memberId of [`z${hexId()}`, `${hexId()}z`]) {
        expectError(
          await call(controller.member, { params: { memberId } }),
          404,
          'Member not found.',
        );
      }
    });
  });

  describe('flags', () => {
    it('lists flagged members by id on bounded pages', async () => {
      const ids = Array.from(
        { length: 51 },
        () => new mongoose.Types.ObjectId(),
      );
      await User.collection.insertMany(
        ids
          .slice(0, 50)
          .reverse()
          .map((_id, index) => ({
            _id,
            username: `flagged-${index}`,
            email: `flagged-${index}@example.test`,
            roles: ['user', 'flagged'],
          })),
      );
      const first = plain<PagedBody>(await call(controller.flaggedMembers));
      first.items
        .map(item => item._id)
        .should.deepEqual(ids.slice(0, 50).map(String));
      first.hasMore.should.equal(false);

      await User.collection.insertOne({
        _id: ids[50],
        username: 'flagged-last',
        email: 'flagged-last@example.test',
        roles: ['user', 'flagged'],
      });
      plain<PagedBody>(
        await call(controller.flaggedMembers),
      ).hasMore.should.equal(true);
    });

    it('sets flags and rejects invalid input or missing members', async () => {
      const { insertedId } = await User.collection.insertOne({
        username: 'flag-target',
        roles: ['user'],
      });
      const res = await call(controller.setFlag, {
        params: { memberId: String(insertedId) },
        body: { flagged: true },
      });
      should(res.body).deepEqual({ flagged: true });
      (
        (await User.findById(insertedId).lean()) as unknown as StoredMember
      ).roles.should.deepEqual(['user', 'flagged']);
      expectError(
        await call(controller.setFlag, {
          params: { memberId: String(insertedId) },
          body: { flagged: 'yes' },
        }),
        400,
        'A boolean flag is required.',
      );
      expectError(
        await call(controller.setFlag, {
          params: { memberId: hexId() },
          body: { flagged: false },
        }),
        404,
        'Member not found.',
      );
    });
  });
});
