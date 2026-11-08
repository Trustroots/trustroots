/**
 * Unit tests for the admin users controller, run against stored members.
 */
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const should: typeof import('should') = require('should');
const proxyquire: typeof import('../../../../testutils/server/mock-module.mts').default = require('../../../../testutils/server/mock-module');

type UsersController =
  typeof import('../../server/controllers/admin.users.server.controller.mts').default;
const adminUsers: UsersController = require('./../../server/controllers/admin.users.server.controller.mts');
const errorService: typeof import('../../../core/server/services/error.server.service.mjs').default = require('./../../../core/server/services/error.server.service.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');

const User = mongoose.model('User');
const AdminNote = mongoose.model('AdminNote');
const Contact = mongoose.model('Contact');
const Message = mongoose.model('Message');
const Offer = mongoose.model('Offer');
const ReferenceThread = mongoose.model('ReferenceThread');
const Thread = mongoose.model('Thread');
const Tribe = mongoose.model('Tribe');

type ObjectId = import('mongoose').Types.ObjectId;
type MockResponse = {
  statusCode: number;
  body: unknown;
  status(code: number | undefined): MockResponse;
  send(body: unknown): MockResponse;
};
type LogEntry = { level: string; message: string; detail: unknown };
type ListedUser = Record<string, unknown> & { username: string };
type Match = ListedUser & { matchReasons: string[] };
type Populated = { _id: string; username: string; displayName: string };

const INVALID_ID = errorService.getErrorMessageByKey('invalid-id');
const NOT_FOUND = errorService.getErrorMessageByKey('not-found');
const error = new Error('lookup failed');
const DEFAULT_ERROR =
  'Snap! Something went wrong. If this keeps happening, please contact us.';

function mockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: undefined,
    status(code) {
      res.statusCode = code ?? 200;
      return res;
    },
    send(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

function plain<T>(res: MockResponse): T {
  return JSON.parse(JSON.stringify(res.body)) as T;
}

function expectMessage(res: MockResponse, status: number, message: string) {
  res.statusCode.should.equal(status);
  should(res.body).deepEqual({ message });
}

let sequence = 0;
async function insertUser(extra: Record<string, unknown> = {}) {
  sequence += 1;
  const doc = {
    username: `zz${sequence}fixture`,
    email: `zz${sequence}fixture@example.test`,
    emailTemporary: '',
    displayName: `Fictional Member ${sequence}`,
    roles: ['user'],
    public: true,
    newsletter: true,
    blocked: [],
    authVersion: 0,
    acquisitionStory: '',
    created: new Date('2026-01-01T00:00:00Z'),
    ...extra,
  };
  const { insertedId } = await User.collection.insertOne(doc);
  return { ...doc, _id: insertedId as ObjectId };
}

function loadWithLogger(logged: LogEntry[]): UsersController {
  return proxyquire<UsersController>(
    require.resolve('./../../server/controllers/admin.users.server.controller.mts'),
    {
      '../../../../config/lib/logger.mjs': (
        level: string,
        message: string,
        detail: unknown,
      ) => {
        logged.push({ level, message, detail });
      },
    },
  );
}

async function getUser(id: unknown, extra: Record<string, unknown> = {}) {
  const res = mockResponse();
  await adminUsers.getUser({ body: { id, ...extra } }, res);
  return res;
}

describe('Admin users controller with stored members', () => {
  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
  });

  describe('member ids', () => {
    it('rejects values that are not ObjectId inputs', async () => {
      const id = new mongoose.Types.ObjectId();
      const toHexString = () => id.toHexString();
      for (const value of [
        null,
        12,
        {},
        { toHexString },
        { id: Buffer.from(id.id) },
        { id: Buffer.from(id.id), toHexString: 'not a function' },
        { id: new Uint8Array(id.id), toHexString },
      ]) {
        expectMessage(await getUser(value), 400, INVALID_ID);
      }
    });

    it('accepts ObjectId-like values with a string or Buffer id', async () => {
      const member = await insertUser();
      const toHexString = () => member._id.toHexString();
      for (const value of [
        { id: member._id.toHexString().slice(0, 12), toHexString },
        { id: Buffer.from(member._id.id), toHexString },
      ]) {
        const res = await getUser(value);
        res.statusCode.should.equal(200);
        plain<{ profile: ListedUser }>(res).profile.username.should.equal(
          member.username,
        );
      }
    });

    it('reports unknown usernames as not found', async () => {
      expectMessage(
        await getUser(undefined, { username: 'ghost-member' }),
        404,
        NOT_FOUND,
      );
    });
  });

  describe('getUser', () => {
    it("counts and lists only the member's own activity", async () => {
      const tribe = await Tribe.collection.insertOne({
        label: 'Fictional Circle',
        slug: 'fictional-circle',
        color: 'aabbcc',
        count: 1,
        description: 'Not to be returned',
      });
      const target = await insertUser({
        member: [{ tribe: tribe.insertedId, since: new Date() }],
        additionalProvidersData: {
          facebook: { accessToken: 'fa', refreshToken: 'fr' },
          github: { accessToken: 'ga', refreshToken: 'gr' },
          twitter: { token: 'tt', tokenSecret: 'ts' },
        },
      });
      const other = await insertUser();
      const third = await insertUser();
      const t = target._id;
      const o = other._id;
      const x = third._id;
      await Message.insertMany([
        { content: 'a', userFrom: t, userTo: o },
        { content: 'b', userFrom: t, userTo: o },
        { content: 'c', userFrom: o, userTo: t },
        { content: 'd', userFrom: o, userTo: x },
      ]);
      await Thread.insertMany([
        { userFrom: t, userTo: o },
        { userFrom: x, userTo: t },
        { userFrom: o, userTo: x },
      ]);
      const reference = (
        userFrom: ObjectId,
        userTo: ObjectId,
        value: 'yes' | 'no',
        day: number,
      ) => ({
        thread: new mongoose.Types.ObjectId(),
        userFrom,
        userTo,
        reference: value,
        created: new Date(Date.UTC(2026, 0, day)),
      });
      await ReferenceThread.insertMany([
        reference(t, o, 'no', 1),
        reference(o, t, 'no', 2),
        reference(x, t, 'no', 3),
        reference(t, x, 'yes', 4),
        reference(o, t, 'yes', 5),
        reference(o, x, 'yes', 6),
      ]);
      await Contact.insertMany([
        { userFrom: t, userTo: o },
        { userFrom: o, userTo: x },
      ]);
      await Offer.collection.insertMany([
        { user: t, type: 'host' },
        { user: o, type: 'host' },
      ]);

      const res = await getUser(String(t));
      res.statusCode.should.equal(200);
      const body = plain<{
        messageFromCount: number;
        messageToCount: number;
        threadCount: number;
        threadReferencesSentNo: number;
        threadReferencesReceivedNo: number;
        threadReferencesReceivedYes: number;
        threadReferencesSentYes: number;
        threadReferences: Array<{
          created: string;
          userFrom: Populated;
          userTo: Populated;
        }>;
        contacts: Array<{ userFrom: Populated; userTo: Populated }>;
        offers: unknown[];
        profile: ListedUser & {
          additionalProvidersData: Record<string, Record<string, string>>;
          member: Array<{ tribe: Record<string, unknown> }>;
        };
      }>(res);
      body.messageFromCount.should.equal(2);
      body.messageToCount.should.equal(1);
      body.threadCount.should.equal(2);
      body.threadReferencesSentNo.should.equal(1);
      body.threadReferencesReceivedNo.should.equal(2);
      body.threadReferencesReceivedYes.should.equal(1);
      body.threadReferencesSentYes.should.equal(1);
      body.threadReferences
        .map(item => item.created)
        .should.deepEqual(
          [5, 4, 3, 2, 1].map(day =>
            new Date(Date.UTC(2026, 0, day)).toISOString(),
          ),
        );
      const profileOf = (member: { _id: ObjectId; username: string }) => ({
        _id: String(member._id),
        username: member.username,
        displayName: (member as { displayName?: string }).displayName,
      });
      should(body.threadReferences[0].userFrom).deepEqual(profileOf(other));
      should(body.threadReferences[0].userTo).deepEqual(profileOf(target));
      body.contacts.length.should.equal(1);
      should(body.contacts[0].userFrom).deepEqual(profileOf(target));
      should(body.contacts[0].userTo).deepEqual(profileOf(other));
      body.offers.length.should.equal(1);
      should(body.profile.member[0].tribe).deepEqual({
        _id: String(tribe.insertedId),
        label: 'Fictional Circle',
        slug: 'fictional-circle',
      });
      const hidden = '(Hidden from admins.)';
      should(body.profile.additionalProvidersData).deepEqual({
        facebook: { accessToken: hidden, refreshToken: hidden },
        github: { accessToken: hidden, refreshToken: hidden },
        twitter: { token: hidden, tokenSecret: hidden },
      });

      const plainProfile = plain<{ profile: ListedUser }>(
        await getUser(String(o)),
      ).profile;
      should(plainProfile).not.have.properties([
        'additionalProvidersData',
        'removeProfileToken',
        'resetPasswordToken',
      ]);
    });

    it('looks for potential duplicates of suspended members', async () => {
      const suspended = await insertUser({
        username: 'riverstone',
        email: 'riverstone@example.test',
        roles: ['user', 'suspended'],
      });
      await insertUser({
        username: 'river-stone2',
        email: 'other@example.test',
      });
      const res = await getUser(String(suspended._id));
      plain<{ potentialMatches: Match[] }>(res)
        .potentialMatches.map(match => [match.username, match.matchReasons])
        .should.deepEqual([['river-stone2', ['Username identifier']]]);
    });
  });

  describe('findPotentialMatches', () => {
    function restricted(extra: Record<string, unknown>) {
      return {
        _id: new mongoose.Types.ObjectId(),
        username: 'abc',
        email: 'a@example.test',
        emailTemporary: '',
        acquisitionStory: '',
        ...extra,
      };
    }

    it('matches identifiers in usernames and email local parts only, newest first', async () => {
      await insertUser({
        username: 'quartzfox-old',
        created: new Date('2026-01-01T00:00:00Z'),
      });
      await insertUser({
        username: 'quartzfox-new-a',
        created: new Date('2026-03-01T00:00:00Z'),
      });
      await insertUser({
        username: 'quartzfox-new-b',
        created: new Date('2026-03-01T00:00:00Z'),
      });
      await insertUser({
        username: 'legacy-case',
        email: 'Quartz.Fox@Example.test',
        created: new Date('2025-01-01T00:00:00Z'),
      });
      await insertUser({
        username: 'legacy-temporary',
        emailTemporary: 'QUARTZFOX@example.test',
        created: new Date('2024-01-01T00:00:00Z'),
      });
      await insertUser({
        username: 'domain-only',
        email: 'someone@quartzfox.example',
        emailTemporary: 'someone@quartzfox.example',
      });

      const matches = await adminUsers.findPotentialMatches(
        restricted({ username: 'quartzfox' }),
      );
      matches
        .map(match => match.username)
        .should.deepEqual([
          'quartzfox-new-a',
          'quartzfox-new-b',
          'quartzfox-old',
          'legacy-case',
          'legacy-temporary',
        ]);
    });

    it('matches acquisition stories after normalising whitespace and case', async () => {
      await insertUser({
        username: 'story-match',
        acquisitionStory: 'found via a friend',
      });
      await insertUser({
        username: 'story-sharp-s',
        acquisitionStory: 'Weiß',
      });
      await insertUser({
        username: 'story-blank',
        acquisitionStory: '   ',
      });

      const friend = await adminUsers.findPotentialMatches(
        restricted({ acquisitionStory: '  Found  via a FRIEND ' }),
      );
      friend
        .map(match => [match.username, match.matchReasons])
        .should.deepEqual([['story-match', ['Acquisition story']]]);

      const sharpS = await adminUsers.findPotentialMatches(
        restricted({ acquisitionStory: 'weiß' }),
      );
      sharpS.map(match => match.username).should.deepEqual(['story-sharp-s']);

      (await adminUsers.findPotentialMatches(restricted({}))).should.deepEqual(
        [],
      );
    });
  });

  describe('member lists', () => {
    async function search(term: unknown, extra: Record<string, unknown> = {}) {
      const res = mockResponse();
      await adminUsers.searchUsers(
        { body: { search: term, ...extra } } as Parameters<
          typeof adminUsers.searchUsers
        >[0],
        res,
      );
      return res;
    }

    it('rejects short, padded or wrongly sorted searches', async () => {
      expectMessage(
        await search('  ab  '),
        400,
        'Query string at least 3 characters long required.',
      );
      expectMessage(
        await search('member', { sort: { column: ['username'] } }),
        400,
        'Invalid member-list options.',
      );
    });

    it('matches literal hyphens and whitespace-tolerant, case-insensitive names', async () => {
      await insertUser({
        username: 'dash-exact',
        displayName: 'fictional-dash',
      });
      await insertUser({ username: 'dash-none', displayName: 'fictionaldash' });
      await insertUser({ username: 'ada', displayName: 'Ada  Lovelace' });

      const names = async (term: string) =>
        plain<{ users: ListedUser[] }>(await search(term)).users.map(
          user => user.username,
        );
      (await names('fictional-dash')).should.deepEqual(['dash-exact']);
      (await names('ADA lovelace')).should.deepEqual(['ada']);
    });

    it('rejects IP identifiers that are not exactly 64 hex characters', async () => {
      const hash = 'a'.repeat(64);
      for (const ipHash of [[hash], `x${hash}`]) {
        const res = mockResponse();
        await adminUsers.listUsersByLastIpHash({ body: { ipHash } }, res);
        expectMessage(res, 400, 'Invalid IP identifier.');
      }
    });
  });

  describe('listStaffBlockers', () => {
    it('lists all staff teams and their blockers by username', async () => {
      const admin = await insertUser({
        username: 'staff-c',
        roles: ['user', 'admin'],
      });
      const support = await insertUser({
        username: 'staff-a',
        roles: ['user', 'support-team'],
      });
      await insertUser({
        username: 'staff-b',
        roles: ['user', 'welcome-team'],
      });
      await insertUser({ username: 'blocker-z', blocked: [support._id] });
      await insertUser({ username: 'blocker-y', blocked: [support._id] });
      const legacy = await insertUser({ username: 'legacy-member' });
      await User.collection.updateOne(
        { _id: legacy._id },
        { $unset: { blocked: '' } },
      );

      const res = mockResponse();
      await adminUsers.listStaffBlockers(
        { user: { _id: admin._id, roles: ['user', 'admin'] } },
        res,
      );
      const staff =
        plain<
          Array<{ username: string; blockedBy: Array<{ username: string }> }>
        >(res);
      staff
        .map(member => [
          member.username,
          member.blockedBy.map(blocker => blocker.username),
        ])
        .should.deepEqual([
          ['staff-a', ['blocker-y', 'blocker-z']],
          ['staff-b', []],
          ['staff-c', []],
        ]);
    });
  });

  describe('changeRole', () => {
    const adminUser = {
      _id: new mongoose.Types.ObjectId(),
      roles: ['user', 'admin'],
    };

    async function change(
      roles: string[],
      role: string,
      action?: string,
    ): Promise<{
      res: MockResponse;
      saved: Record<string, unknown> & { roles: string[] };
      note: string | undefined;
    }> {
      const member = await insertUser({ roles });
      const res = mockResponse();
      await adminUsers.changeRole(
        {
          body: { id: String(member._id), role, action },
          user: adminUser,
        },
        res,
      );
      const saved = (await User.collection.findOne({
        _id: member._id,
      })) as unknown as Record<string, unknown> & { roles: string[] };
      const note = await AdminNote.collection.findOne({ user: member._id });
      return { res, saved, note: note?.note as string | undefined };
    }

    const action = (message: string) =>
      `<p><b>Performed action:</b></p><p><i>${message}</i></p>`;

    it('rejects unknown actions', async () => {
      const { res } = await change(['user'], 'welcome-team', 'bogus');
      expectMessage(res, 400, 'Invalid role.');
    });

    it('replaces only the conflicting role and describes the change', async () => {
      // Roles besides 'user' before | role | action | roles after | note
      for (const line of [
        'volunteer-alumni welcome-team | volunteer | - | welcome-team volunteer | User made into volunteer.',
        'volunteer | volunteer-alumni | add | volunteer-alumni | User made into volunteer-alumni.',
        'suspended volunteer | shadowban | add | volunteer shadowban | User shadowbanned.',
        'volunteer-alumni shadowban | support-team | add | volunteer-alumni shadowban support-team | Role "support-team" added.',
        'volunteer suspended | welcome-team | add | volunteer suspended welcome-team | Role "welcome-team" added.',
        'welcome-team | welcome-team | remove |  | Role "welcome-team" removed.',
        'shadowban | shadowban | remove |  | User unshadowbanned.',
      ]) {
        const [before, role, verb, after, message] = line.split(' | ');
        const roles = (list: string) => [
          'user',
          ...list.split(' ').filter(Boolean),
        ];
        const { res, saved, note } = await change(
          roles(before),
          role,
          verb === '-' ? undefined : verb,
        );
        should(res.body).deepEqual({ message: 'Role changed.' });
        saved.roles.should.deepEqual(roles(after));
        saved.authVersion!.should.equal(1);
        saved.public!.should.equal(true);
        saved.newsletter!.should.equal(true);
        should(note).equal(action(message));
      }
    });

    it('hides and unsubscribes suspended members', async () => {
      const { saved, note } = await change(
        ['user', 'shadowban', 'welcome-team'],
        'suspended',
      );
      saved.roles.should.deepEqual(['user', 'welcome-team', 'suspended']);
      saved.public!.should.equal(false);
      saved.newsletter!.should.equal(false);
      should(note).equal(action('User suspended.'));
    });

    it('gives up after five conflicting concurrent updates', async () => {
      for (const [conflicts, status] of [
        [4, 200],
        [5, 404],
      ]) {
        const member = await insertUser();
        const updateOne = User.updateOne;
        let calls = 0;
        const stub = sinon.stub(User, 'updateOne').callsFake(async function (
          this: typeof User,
          ...args: Parameters<typeof User.updateOne>
        ) {
          calls += 1;
          if (calls <= conflicts) {
            await User.collection.updateOne({ _id: member._id }, {
              $push: { roles: `concurrent-${calls}` },
            } as never);
          }
          return updateOne.apply(this, args);
        } as never);
        const res = mockResponse();
        await adminUsers.changeRole(
          {
            body: { id: String(member._id), role: 'welcome-team' },
            user: adminUser,
          },
          res,
        );
        res.statusCode.should.equal(status);
        if (status === 404) should(res.body).deepEqual({ message: NOT_FOUND });
        stub.restore();
      }
    });
  });

  describe('usernameToUserId', () => {
    async function resolve(username: unknown) {
      const req: { body: { username: unknown }; userIdFromUsername?: unknown } =
        { body: { username } };
      const res = mockResponse();
      let nextCalled = false;
      await adminUsers.usernameToUserId(req, res, () => {
        nextCalled = true;
      });
      return { req, res, nextCalled };
    }

    it('accepts usernames up to the account identifier limit', async () => {
      await insertUser();
      // An account without a username must not match a missing one.
      await User.collection.insertOne({ email: 'nameless@example.test' });
      should((await resolve(undefined)).req.userIdFromUsername).be.undefined();
      const longest = await resolve('x'.repeat(320));
      longest.nextCalled.should.equal(true);
      should(longest.req.userIdFromUsername).be.undefined();

      const tooLong = await resolve('x'.repeat(321));
      tooLong.nextCalled.should.equal(false);
      expectMessage(tooLong.res, 400, 'Invalid username.');
    });
  });

  // Each call loads a fresh copy of the controller inside the running test, so
  // these tests also cover (and can kill) mutants in its module-level values.
  describe('with a fresh copy of the controller', () => {
    it('lists, profiles and matches members with the documented fields', async () => {
      const controller = loadWithLogger([]);
      const listed = ['_id', 'created', 'displayName', 'email'];
      listed.push('emailTemporary', 'lastIpHash', 'public', 'roles');
      listed.push('removeProfileExpires', 'removeProfileToken');
      listed.push('resetPasswordExpires', 'resetPasswordToken', 'username');
      const fields = {
        lastIpHash: 'a'.repeat(64),
        removeProfileExpires: new Date(),
        removeProfileToken: 'remove',
        resetPasswordExpires: new Date(),
        resetPasswordToken: 'reset',
      };
      const suspended = await insertUser({
        ...fields,
        username: 'fieldfox',
        roles: ['user', 'suspended'],
      });
      await insertUser({ ...fields, username: 'fieldfox-2' });
      const res = mockResponse();
      await controller.searchUsers({ body: { search: 'fieldfox' } }, res);
      const list = plain<{ users: ListedUser[]; sort: unknown }>(res);
      should(list.sort).deepEqual({
        column: 'username',
        direction: 'ascending',
      });
      list.users
        .map(user => user.username)
        .should.deepEqual(['fieldfox', 'fieldfox-2']);
      for (const user of list.users)
        Object.keys(user).sort().should.deepEqual(listed.sort());

      const profile = mockResponse();
      await controller.getUser(
        { body: { id: String(suspended._id) } },
        profile,
      );
      const body = plain<
        Record<string, unknown> & { potentialMatches: Match[] }
      >(profile);
      const none = {
        total: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        unpublished: 0,
      };
      should(body.experiencesReceived).deepEqual(none);
      should(body.experiencesWritten).deepEqual(none);
      Object.keys(body.potentialMatches[0])
        .sort()
        .should.deepEqual(
          [...listed, 'acquisitionStory', 'matchReasons'].sort(),
        );
    });

    const adminUser = { _id: new mongoose.Types.ObjectId(), roles: ['admin'] };
    for (const [name, message, fail, request] of [
      [
        'getUser',
        'Failed to load member in admin tool. #ggi323',
        () => sinon.stub(User, 'findById').throws(error),
        async () => ({ body: { id: String(new mongoose.Types.ObjectId()) } }),
      ],
      [
        'listStaffBlockers',
        'Failed to load members who blocked staff.',
        () => sinon.stub(User, 'find').throws(error),
        async () => ({ user: adminUser }),
      ],
      [
        'changeRole',
        'Failed to update member in admin tool. #ggi323',
        () => sinon.stub(AdminNote.prototype, 'save').rejects(error),
        async () => ({
          body: { id: String((await insertUser())._id), role: 'welcome-team' },
          user: adminUser,
        }),
      ],
    ] as const) {
      it(`${name} logs and reports failures`, async () => {
        const logged: LogEntry[] = [];
        const controller = loadWithLogger(logged);
        const req = await request();
        fail();
        const res = mockResponse();
        await (
          controller[name] as (req: unknown, res: unknown) => Promise<unknown>
        )(req, res);
        expectMessage(res, 400, DEFAULT_ERROR);
        should(logged).deepEqual([
          { level: 'error', message, detail: { error } },
        ]);
      });
    }
  });
});
