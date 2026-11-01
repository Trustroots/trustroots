/**
 * Unit tests for uncovered admin users controller paths.
 */
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');

const adminUsers: typeof import('../../server/controllers/admin.users.server.controller.mts').default = require('./../../server/controllers/admin.users.server.controller.mts');
const errorService: typeof import('../../../core/server/services/error.server.service.mjs').default = require('./../../../core/server/services/error.server.service.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
const should: typeof import('should') = require('should');

type UserRecord =
  import('../../../../testutils/server/model-contracts.mts').UserRecord;
type UserModel =
  import('../../../../testutils/server/model-contracts.mts').UserModel;
type UserDocument =
  import('../../../../testutils/server/model-contracts.mts').UserModelDocument;
type ContactRecord =
  import('../../../../testutils/server/model-contracts.mts').ContactRecord;
type ContactModel =
  import('../../../../testutils/server/model-contracts.mts').ContactModel;
type OfferRecord =
  import('../../../../testutils/server/model-contracts.mts').OfferRecord;
type OfferModel =
  import('../../../../testutils/server/model-contracts.mts').OfferModel;
type ReferenceThreadRecord =
  import('../../../../testutils/server/model-contracts.mts').ReferenceThreadRecord;
type ReferenceThreadModel =
  import('../../../../testutils/server/model-contracts.mts').ReferenceThreadModel;
const User = mongoose.model<UserRecord, UserModel>('User');
const Contact = mongoose.model<ContactRecord, ContactModel>('Contact');
const Experience = mongoose.model('Experience');
const Offer = mongoose.model<OfferRecord, OfferModel>('Offer');
const ReferenceThread = mongoose.model<
  ReferenceThreadRecord,
  ReferenceThreadModel
>('ReferenceThread');
const AdminNote = mongoose.model('AdminNote');
const Message = mongoose.model('Message');
const Thread = mongoose.model('Thread');

interface AdminUserResponse {
  _id?: { toString(): string };
  removeProfileToken?: string;
  resetPasswordToken?: string;
  additionalProvidersData?: {
    facebook?: { accessToken?: string };
    github?: { accessToken?: string };
    twitter?: { token?: string };
  };
}
interface ExperienceStats {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  unpublished: number;
}
interface AdminResponseBody {
  experiencesReceived?: ExperienceStats;
  experiencesWritten?: ExperienceStats;
  message?: string;
  users?: Array<AdminUserResponse | null | undefined>;
  pagination?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
  sort?: { column?: string; direction?: string };
  profile?: { username?: string };
  messageFromCount?: number;
  contacts?: unknown[];
  offers?: unknown[];
  threadReferences?: unknown[];
  length?: number;
}
interface AdminBlockerResponse {
  _id: { equals(id: unknown): boolean };
  blockedBy: Array<{
    _id?: import('mongoose').Types.ObjectId;
    username?: string;
    displayName?: string;
  }>;
}
type AdminResponse = AdminResponseBody | AdminBlockerResponse[];
interface MockResponse {
  statusCode: number;
  body: AdminResponse | null;
  status(code: number): this;
  send(body: AdminResponse): this;
  waitForResponse(): Promise<MockResponse>;
}
function mockResponse(): MockResponse {
  let resolveResponse: (value: MockResponse) => void;
  const promise = new Promise<MockResponse>(resolve => {
    resolveResponse = resolve;
  });
  const res: MockResponse = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(body) {
      res.body = body;
      resolveResponse(res);
      return res;
    },
    waitForResponse: () => promise,
  };
  return res;
}
function present<T>(
  value: T | null | undefined,
  description: string,
): NonNullable<T> {
  if (value === null || value === undefined)
    throw new Error(`Expected ${description}`);
  return value;
}
function assertPresent<T>(
  value: T | null | undefined,
  description: string,
): asserts value is T {
  if (value === null || value === undefined)
    throw new Error(`Expected ${description}`);
}

function responseBody(res: MockResponse): AdminResponseBody {
  if (res.body === null) throw new Error('Expected admin response body');
  if (Array.isArray(res.body))
    throw new Error('Expected an object admin response body');
  return res.body;
}
function responseArray(res: MockResponse): AdminBlockerResponse[] {
  if (!Array.isArray(res.body))
    throw new Error('Expected an array response body');
  return res.body;
}
function staffResponse(
  res: MockResponse,
  predicate: (staff: AdminBlockerResponse) => boolean,
): AdminBlockerResponse {
  const staff = responseArray(res).find(predicate);
  if (!staff) throw new Error('Expected matching staff response');
  return staff;
}
function adminUserAt(res: MockResponse, index: number): AdminUserResponse {
  const user = responseField(res, 'users')[index];
  if (!user) throw new Error(`Expected user at response index ${index}`);
  return user;
}
function adminUserToken(
  res: MockResponse,
  index: number,
  key: 'removeProfileToken' | 'resetPasswordToken',
): string {
  const token = adminUserAt(res, index)[key];
  if (typeof token !== 'string')
    throw new Error(`Expected ${key} in user response`);
  return token;
}
function adminProviderCredential(
  res: MockResponse,
  index: number,
  provider: 'facebook' | 'github' | 'twitter',
): string {
  const providers = adminUserAt(res, index).additionalProvidersData;
  const credential =
    provider === 'twitter'
      ? providers?.twitter?.token
      : providers?.[provider]?.accessToken;
  if (typeof credential !== 'string')
    throw new Error(`Expected ${provider} credential in user response`);
  return credential;
}
function adminUserId(res: MockResponse, index: number): { toString(): string } {
  const id = adminUserAt(res, index)._id;
  if (!id) throw new Error('Expected user id in response');
  return id;
}
function responseField<Key extends keyof AdminResponseBody>(
  res: MockResponse,
  key: Key,
): NonNullable<AdminResponseBody[Key]> {
  const value = responseBody(res)[key];
  if (value === undefined || value === null)
    throw new Error(`Expected admin response field ${key}`);
  return value as NonNullable<AdminResponseBody[Key]>;
}

interface MemberListQueryOptions {
  count?: number;
  countError?: Error;
  findError?: Error;
  users?: Array<UserDocument | null> | null;
}
interface MemberListCalls {
  sort?: Record<string, number>;
  skip?: number;
  limit?: number;
}
function stubMemberListQuery({
  count = 0,
  countError,
  findError,
  users = [],
}: MemberListQueryOptions = {}): MemberListCalls {
  const calls: MemberListCalls = {};
  const countQuery = {
    exec: () =>
      countError ? Promise.reject(countError) : Promise.resolve(count),
  };
  sinon
    .stub(User, 'countDocuments')
    .returns(countQuery as unknown as ReturnType<typeof User.countDocuments>);
  const findQuery = {
    select() {
      return this;
    },
    sort(value: Record<string, number>) {
      calls.sort = value as Record<string, number>;
      return this;
    },
    skip(value: number) {
      calls.skip = value;
      return this;
    },
    limit(value: number) {
      calls.limit = value;
      return this;
    },
    exec() {
      return findError ? Promise.reject(findError) : Promise.resolve(users);
    },
  };
  sinon
    .stub(User, 'find')
    .returns(findQuery as unknown as ReturnType<typeof User.find>);
  return calls;
}

describe('Admin users controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  describe('searchUsers', () => {
    it('rejects missing queries', () => {
      const res = mockResponse();
      adminUsers.searchUsers({ body: {} }, res);

      res.statusCode.should.equal(400);
      responseField(res, 'message').should.equal(
        'Query string at least 3 characters long required.',
      );
    });

    it('rejects queries shorter than three characters', () => {
      const res = mockResponse();
      adminUsers.searchUsers({ body: { search: 'ab' } }, res);

      res.statusCode.should.equal(400);
      responseField(res, 'message').should.equal(
        'Query string at least 3 characters long required.',
      );
    });

    it('rejects invalid pagination and sorting options', () => {
      [
        { page: 0 },
        { page: '2' },
        { sort: { column: 'not-a-column', direction: 'ascending' } },
        { sort: { column: 'created', direction: 'sideways' } },
      ].forEach(options => {
        const res = mockResponse();
        adminUsers.searchUsers({ body: { search: 'alice', ...options } }, res);
        res.statusCode.should.equal(400);
        responseField(res, 'message').should.equal(
          'Invalid member-list options.',
        );
      });
    });

    it('applies server sorting and clamps pages past the final page', async () => {
      const calls = stubMemberListQuery({ count: 151, users: [] });
      const res = mockResponse();

      adminUsers.searchUsers(
        {
          body: {
            page: 99,
            search: 'alice',
            sort: { column: 'created', direction: 'descending' },
          },
        },
        res,
      );
      await res.waitForResponse();

      present(calls.sort, 'requested sort').should.deepEqual({
        created: -1,
        _id: 1,
      });
      present(calls.skip, 'requested skip').should.equal(150);
      present(calls.limit, 'requested limit').should.equal(150);
      responseField(res, 'pagination').should.deepEqual({
        page: 2,
        pageSize: 150,
        total: 151,
        totalPages: 2,
      });
      responseField(res, 'sort').should.deepEqual({
        column: 'created',
        direction: 'descending',
      });
    });

    it('returns 400 when counting matching members fails', async () => {
      stubMemberListQuery({
        countError: new Error('count failed'),
      });
      const res = mockResponse();

      adminUsers.searchUsers({ body: { search: 'alice' } }, res);
      await res.waitForResponse();

      res.statusCode.should.equal(400);
    });

    it('returns 400 when the database lookup fails', async () => {
      stubMemberListQuery({
        findError: new Error('search failed'),
      });

      const res = mockResponse();
      adminUsers.searchUsers({ body: { search: 'abc' } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('obfuscates sensitive tokens in search results', async () => {
      const users = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(users[0]._id);
      assertPresent(userDoc, 'saved user');
      userDoc.removeProfileToken = 'remove-token';
      userDoc.resetPasswordToken = 'reset-token';
      await userDoc.save();

      const res = mockResponse();
      adminUsers.searchUsers({ body: { search: userDoc.username } }, res);
      await res.waitForResponse();

      responseField(res, 'users').length.should.equal(1);
      adminUserToken(res, 0, 'removeProfileToken').should.equal(
        '(Hidden from admins.)',
      );
      adminUserToken(res, 0, 'resetPasswordToken').should.equal(
        '(Hidden from admins.)',
      );
      responseField(res, 'pagination').should.deepEqual({
        page: 1,
        pageSize: 150,
        total: 1,
        totalPages: 1,
      });
      responseField(res, 'sort').should.deepEqual({
        column: 'username',
        direction: 'ascending',
      });
    });

    it('obfuscates OAuth tokens in search results', async () => {
      const users = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(users[0]._id);
      assertPresent(userDoc, 'saved user');
      userDoc.additionalProvidersData = {
        facebook: { accessToken: 'fb-access', refreshToken: 'fb-refresh' },
        github: { accessToken: 'gh-access', refreshToken: 'gh-refresh' },
        twitter: { token: 'tw-token', tokenSecret: 'tw-secret' },
      } as unknown as UserRecord['additionalProvidersData'];
      await userDoc.save();

      stubMemberListQuery({ count: 1, users: [userDoc] });

      const res = mockResponse();
      adminUsers.searchUsers({ body: { search: userDoc.username } }, res);
      await res.waitForResponse();

      responseField(res, 'users').length.should.equal(1);
      adminProviderCredential(res, 0, 'facebook').should.equal(
        '(Hidden from admins.)',
      );
      adminProviderCredential(res, 0, 'github').should.equal(
        '(Hidden from admins.)',
      );
      adminProviderCredential(res, 0, 'twitter').should.equal(
        '(Hidden from admins.)',
      );
    });

    it('returns an empty array when the database returns no users', async () => {
      stubMemberListQuery({ users: null });

      const res = mockResponse();
      adminUsers.searchUsers({ body: { search: 'abc' } }, res);
      await res.waitForResponse();
      responseField(res, 'users').should.deepEqual([]);
      responseField(res, 'pagination').total!.should.equal(0);
      responseField(res, 'pagination').totalPages!.should.equal(0);
    });

    it('keeps null database rows unchanged while obfuscating results', async () => {
      stubMemberListQuery({ count: 1, users: [null] });

      const res = mockResponse();
      adminUsers.searchUsers({ body: { search: 'abc' } }, res);
      await res.waitForResponse();
      responseField(res, 'users').should.deepEqual([undefined]);
    });

    it('throws when creating a search expression from a non-string value', () => {
      (() =>
        adminUsers.searchUsers(
          { body: { search: { length: 3 } } },
          mockResponse(),
        )).should.throw('Expected a string');
    });
  });

  describe('listUsersByRole', () => {
    it('rejects missing roles', async () => {
      const res = mockResponse();
      adminUsers.listUsersByRole({ body: {} }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      responseField(res, 'message').should.equal('Invalid role.');
    });

    it('rejects an invalid role', async () => {
      const res = mockResponse();
      adminUsers.listUsersByRole({ body: { role: 'not-a-role' } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      responseField(res, 'message').should.equal('Invalid role.');
    });

    it('rejects the legacy moderator role', async () => {
      const res = mockResponse();
      adminUsers.listUsersByRole({ body: { role: 'moderator' } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      responseField(res, 'message').should.equal('Invalid role.');
    });

    it('returns users with the requested role', async () => {
      const users = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(users[0]._id);
      assertPresent(userDoc, 'saved user');
      userDoc.roles = ['user', 'volunteer'];
      await userDoc.save();

      const res = mockResponse();
      adminUsers.listUsersByRole({ body: { role: 'volunteer' } }, res);
      await res.waitForResponse();
      responseField(res, 'users').length.should.equal(1);
      adminUserId(res, 0).toString().should.equal(userDoc._id.toString());
    });

    it('returns an empty array when the role lookup returns no users', async () => {
      stubMemberListQuery({ users: null });

      const res = mockResponse();
      adminUsers.listUsersByRole({ body: { role: 'volunteer' } }, res);
      await res.waitForResponse();
      responseField(res, 'users').should.deepEqual([]);
    });

    it('returns 400 when the database lookup fails', async () => {
      stubMemberListQuery({
        findError: new Error('role lookup failed'),
      });

      const res = mockResponse();
      adminUsers.listUsersByRole({ body: { role: 'volunteer' } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns users when the role query returns an empty array', async () => {
      stubMemberListQuery({ users: [] });

      const res = mockResponse();
      adminUsers.listUsersByRole({ body: { role: 'volunteer' } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      responseField(res, 'users').should.deepEqual([]);
    });
  });

  describe('listUsersByLastIpHash', () => {
    it('rejects missing and invalid IP addresses', () => {
      const missingResponse = mockResponse();
      adminUsers.listUsersByLastIpHash({ body: {} }, missingResponse);
      missingResponse.statusCode.should.equal(400);
      responseField(missingResponse, 'message').should.equal(
        'Invalid IP identifier.',
      );

      const invalidResponse = mockResponse();
      adminUsers.listUsersByLastIpHash(
        { body: { ipHash: 'not-an-ip-address' } },
        invalidResponse,
      );
      invalidResponse.statusCode.should.equal(400);
      responseField(invalidResponse, 'message').should.equal(
        'Invalid IP identifier.',
      );
    });

    it('returns exact IP-address matches', async () => {
      const users = await utils.saveUsers(utils.generateUsers(2));
      users[0].lastIpHash =
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      users[1].lastIpHash =
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      await Promise.all(users.map(user => user.save()));

      const res = mockResponse();
      adminUsers.listUsersByLastIpHash(
        {
          body: {
            ipHash:
              'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          },
        },
        res,
      );
      await res.waitForResponse();

      responseField(res, 'users').should.have.length(1);
      adminUserId(res, 0).toString().should.equal(users[0]._id.toString());
    });

    it('returns an empty array when no member has the requested address', async () => {
      stubMemberListQuery({ users: null });

      const res = mockResponse();
      adminUsers.listUsersByLastIpHash(
        {
          body: {
            ipHash:
              'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          },
        },
        res,
      );
      await res.waitForResponse();

      responseField(res, 'users').should.deepEqual([]);
    });

    it('returns 400 when the IP-address lookup fails', async () => {
      stubMemberListQuery({
        findError: new Error('IP lookup failed'),
      });

      const res = mockResponse();
      adminUsers.listUsersByLastIpHash(
        {
          body: {
            ipHash:
              'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });
  });

  describe('getUser', () => {
    it('returns 400 for an invalid id', async () => {
      const res = mockResponse();
      await adminUsers.getUser({ body: { id: 'bad-id' } }, res);

      res.statusCode.should.equal(400);
      responseField(res, 'message').should.equal(
        errorService.getErrorMessageByKey('invalid-id'),
      );
    });

    it('returns 404 for missing users', async () => {
      const res = mockResponse();
      await adminUsers.getUser(
        { body: { id: new mongoose.Types.ObjectId().toString() } },
        res,
      );

      res.statusCode.should.equal(404);
      responseField(res, 'message').should.equal(
        errorService.getErrorMessageByKey('not-found'),
      );
    });

    it('returns profile details for an existing user', async () => {
      const users = await utils.saveUsers(utils.generateUsers(1));
      const res = mockResponse();

      await adminUsers.getUser({ body: { id: users[0]._id.toString() } }, res);

      responseField(res, 'profile').username!.should.equal(users[0].username);
      responseField(res, 'messageFromCount').should.equal(0);
      responseField(res, 'experiencesReceived').should.deepEqual({
        total: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        unpublished: 0,
      });
      responseField(res, 'experiencesWritten').should.deepEqual({
        total: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        unpublished: 0,
      });
    });

    it('counts received and written experiences without mixing unpublished recommendations or removed records', async () => {
      const users = await utils.saveUsers(utils.generateUsers(8));
      const member = users[0]._id;
      const categories = [
        { public: true, recommend: 'yes' },
        { public: true, recommend: 'no' },
        { public: true, recommend: 'unknown' },
        { public: false, recommend: 'no' },
        { public: true, recommend: 'yes', removedAt: new Date() },
      ];
      await Experience.create([
        ...categories.map((category, index) => ({
          userFrom: users[index + 1]._id,
          userTo: member,
          ...category,
        })),
        ...categories.slice(2).map((category, index) => ({
          userFrom: member,
          userTo: users[index + 1]._id,
          ...category,
        })),
        {
          userFrom: users[6]._id,
          userTo: users[7]._id,
          public: true,
          recommend: 'no',
        },
      ]);
      const res = mockResponse();
      await adminUsers.getUser({ body: { id: member.toString() } }, res);
      res.statusCode.should.equal(200);
      const expected = {
        total: 4,
        positive: 1,
        negative: 1,
        neutral: 1,
        unpublished: 1,
      };
      responseField(res, 'experiencesReceived').should.deepEqual(expected);
      responseField(res, 'experiencesWritten').should.deepEqual({
        total: 2,
        positive: 0,
        negative: 0,
        neutral: 1,
        unpublished: 1,
      });
    });

    it('defaults nullable contact and offer lookups to empty arrays', async () => {
      const users = await utils.saveUsers(utils.generateUsers(1));
      const nullContactQuery = {
        populate() {
          return this;
        },
        then(resolve: (value: null) => unknown) {
          return resolve(null);
        },
      };
      sinon
        .stub(Contact, 'find')
        .returns(
          nullContactQuery as unknown as ReturnType<typeof Contact.find>,
        );
      sinon
        .stub(Offer, 'find')
        .returns(
          Promise.resolve(null) as unknown as ReturnType<typeof Offer.find>,
        );
      const res = mockResponse();

      await adminUsers.getUser({ body: { id: users[0]._id.toString() } }, res);

      res.statusCode.should.equal(200);
      responseField(res, 'contacts').should.deepEqual([]);
      responseField(res, 'offers').should.deepEqual([]);
    });

    it('defaults nullable thread references to an empty array', async () => {
      const users = await utils.saveUsers(utils.generateUsers(1));
      sinon.stub(ReferenceThread, 'find').returns({
        sort: () => ({
          limit: () => ({
            populate: () => ({
              populate: () => Promise.resolve(null),
            }),
          }),
        }),
      } as unknown as ReturnType<typeof ReferenceThread.find>);
      const res = mockResponse();

      await adminUsers.getUser({ body: { id: users[0]._id.toString() } }, res);

      res.statusCode.should.equal(200);
      responseField(res, 'threadReferences').should.deepEqual([]);
    });

    it('returns 400 when loading a user fails', async () => {
      sinon.stub(User, 'findById').returns({
        select: () => ({
          populate: () => Promise.reject(new Error('lookup failed')),
        }),
      } as unknown as ReturnType<typeof User.findById>);

      const res = mockResponse();
      await adminUsers.getUser(
        { body: { id: new mongoose.Types.ObjectId().toString() } },
        res,
      );

      res.statusCode.should.equal(400);
    });
  });

  describe('listStaffBlockers', () => {
    it('lists blockers for every admin and Welcome team member', async () => {
      const users = utils.generateUsers(4);
      users[0].roles = ['user', 'admin'];
      users[1].roles = ['user', 'welcome-team'];
      users[2].roles = ['user', 'admin'];
      const saved = await utils.saveUsers(users);
      saved[3].blocked = [
        new mongoose.Types.ObjectId(saved[0]._id.toString()),
        new mongoose.Types.ObjectId(saved[1]._id.toString()),
      ];
      await saved[3].save();

      const res = mockResponse();
      await adminUsers.listStaffBlockers(
        { user: { _id: saved[0]._id, roles: ['admin'] } },
        res,
      );

      responseArray(res).length.should.equal(3);
      present(
        staffResponse(res, staff => staff._id.equals(saved[0]._id)).blockedBy[0]
          ._id,
        'blocking user id',
      ).should.deepEqual(saved[3]._id);
      present(
        staffResponse(res, staff => staff._id.equals(saved[1]._id)).blockedBy[0]
          ._id,
        'blocking user id',
      ).should.deepEqual(saved[3]._id);
      staffResponse(res, staff =>
        staff._id.equals(saved[2]._id),
      ).blockedBy.should.deepEqual([]);
    });

    it('limits Welcome team members to blockers of their own account', async () => {
      const users = utils.generateUsers(3);
      users[0].roles = ['user', 'welcome-team'];
      users[1].roles = ['user', 'admin'];
      const saved = await utils.saveUsers(users);
      saved[2].blocked = [
        new mongoose.Types.ObjectId(saved[0]._id.toString()),
        new mongoose.Types.ObjectId(saved[1]._id.toString()),
      ];
      await saved[2].save();

      const res = mockResponse();
      await adminUsers.listStaffBlockers(
        {
          user: { _id: saved[0]._id, roles: ['welcome-team'] },
          query: { userId: saved[1]._id.toString() },
        },
        res,
      );

      responseArray(res).length.should.equal(1);
      responseArray(res)[0].blockedBy[0].username!.should.equal(
        saved[2].username,
      );
      Object.keys(responseArray(res)[0].blockedBy[0]).should.deepEqual([
        '_id',
        'username',
        'displayName',
      ]);
    });

    it('returns an empty list when there are no staff records', async () => {
      sinon.stub(User, 'find').returns({
        select() {
          return this;
        },
        sort() {
          return this;
        },
        lean: () => Promise.resolve([]),
      } as unknown as ReturnType<typeof User.find>);
      const res = mockResponse();

      await adminUsers.listStaffBlockers(
        { user: { _id: new mongoose.Types.ObjectId(), roles: ['admin'] } },
        res,
      );

      should(responseArray(res)).deepEqual([]);
    });

    it('returns 400 when staff blockers cannot be loaded', async () => {
      sinon.stub(User, 'find').returns({
        select() {
          return this;
        },
        sort() {
          return this;
        },
        lean: () => Promise.reject(new Error('lookup failed')),
      } as unknown as ReturnType<typeof User.find>);
      const res = mockResponse();

      await adminUsers.listStaffBlockers(
        { user: { _id: new mongoose.Types.ObjectId(), roles: ['admin'] } },
        res,
      );

      res.statusCode.should.equal(400);
    });
  });

  describe('findPotentialMatches', () => {
    it('normalises usernames and email local parts in label order', async () => {
      const { getAdminIdentityIdentifiers, getUniqueAdminIdentityIdentifiers } =
        await import('../../server/services/admin-identity.server.service.mts');

      getAdminIdentityIdentifiers({
        email: 'Case.Name+tag@example.test',
        emailTemporary: 'Other-Name@example.test',
        username: 'Case.Name',
      }).should.deepEqual([
        { label: 'Username identifier', value: 'casename' },
        { label: 'Email identifier', value: 'casenametag' },
        { label: 'Temporary email identifier', value: 'othername' },
      ]);

      getUniqueAdminIdentityIdentifiers(
        {
          email: 'case-name@example.test',
          emailTemporary: 'Other@example.test',
          username: 'Case.Name',
        },
        8,
      ).should.deepEqual([{ label: 'Username identifier', value: 'casename' }]);
    });

    it('returns no leads when every available identifier is too short', async () => {
      const matches = await adminUsers.findPotentialMatches({
        _id: new mongoose.Types.ObjectId(),
        acquisitionStory: '',
        email: 'a@example.test',
        emailTemporary: '',
        username: 'abc',
      });

      matches.should.deepEqual([]);
    });
  });

  describe('changeRole', () => {
    it('adds and removes welcome-team idempotently while preserving other roles and notes', async () => {
      const [admin, target] = await utils.saveUsers(utils.generateUsers(2));
      target.roles = ['user', 'volunteer'];
      await target.save();
      for (const [index, action] of [
        'add',
        'add',
        'remove',
        'remove',
      ].entries()) {
        const res = mockResponse();
        await adminUsers.changeRole(
          {
            body: { id: String(target._id), role: 'welcome-team', action },
            user: admin,
          },
          res,
        );
        responseField(res, 'message').should.equal('Role changed.');
        const updated = await User.findById(target._id);
        assertPresent(updated, 'updated user');
        Array.from(present(updated.roles, 'user roles')).should.deepEqual(
          action === 'add'
            ? ['user', 'volunteer', 'welcome-team']
            : ['user', 'volunteer'],
        );
        present(updated.authVersion, 'user auth version').should.equal(
          [1, 1, 2, 2][index],
        );
      }
      const notes = await mongoose
        .model('AdminNote')
        .find({ user: target._id });
      notes.length.should.equal(4);
      notes
        .filter(note => note.note.includes('removed'))
        .length.should.equal(2);
    });

    for (const body of [
      { role: 'welcome-team', action: 'invalid' },
      { role: 'welcome-team', action: null },
      { role: 'volunteer', action: 'remove' },
    ]) {
      it(`rejects unsupported role action ${JSON.stringify(
        body,
      )}`, async () => {
        const res = mockResponse();
        await adminUsers.changeRole({ body }, res);
        res.statusCode.should.equal(400);
      });
    }

    it('promotes a volunteer and removes volunteer-alumni', async () => {
      const users = await utils.saveUsers(utils.generateUsers(2));
      const admin = users[0];
      const target = users[1];
      target.roles = ['user', 'volunteer-alumni'];
      await target.save();

      const res = mockResponse();
      await adminUsers.changeRole(
        {
          body: { id: target._id.toString(), role: 'volunteer' },
          user: admin,
        },
        res,
      );

      responseField(res, 'message').should.equal('Role changed.');

      const updated = await User.findById(target._id).exec();
      assertPresent(updated, 'updated user');
      present(updated.roles, 'user roles').should.containEql('volunteer');
      present(updated.roles, 'user roles').should.not.containEql(
        'volunteer-alumni',
      );
    });

    it('promotes a user to volunteer-alumni and removes volunteer', async () => {
      const users = await utils.saveUsers(utils.generateUsers(2));
      const admin = users[0];
      const target = users[1];
      target.roles = ['user', 'volunteer'];
      await target.save();

      const res = mockResponse();
      await adminUsers.changeRole(
        {
          body: { id: target._id.toString(), role: 'volunteer-alumni' },
          user: admin,
        },
        res,
      );

      responseField(res, 'message').should.equal('Role changed.');

      const updated = await User.findById(target._id).exec();
      assertPresent(updated, 'updated user');
      present(updated.roles, 'user roles').should.containEql(
        'volunteer-alumni',
      );
      present(updated.roles, 'user roles').should.not.containEql('volunteer');
    });

    it('increments a missing legacy authVersion for concurrent role changes', async () => {
      const [admin, target] = await utils.saveUsers(utils.generateUsers(2));
      await User.collection.updateOne(
        { _id: target._id },
        { $unset: { authVersion: '' } },
      );

      const responses = await Promise.all(
        ['volunteer', 'welcome-team'].map(role => {
          const res = mockResponse();
          return adminUsers
            .changeRole(
              { body: { id: String(target._id), role }, user: admin },
              res,
            )
            .then(() => res);
        }),
      );

      responses.forEach(res =>
        responseField(res, 'message').should.equal('Role changed.'),
      );
      const updated = await User.findById(target._id).exec();
      assertPresent(updated, 'updated user');
      present(updated.authVersion, 'user auth version').should.equal(2);
      present(updated.roles, 'user roles').should.containEql('volunteer');
      present(updated.roles, 'user roles').should.containEql('welcome-team');
    });

    it('retries a stale role update without applying the change twice', async () => {
      const [admin, target] = await utils.saveUsers(utils.generateUsers(2));
      const updateOne = sinon.stub(User, 'updateOne').callThrough();
      updateOne.onFirstCall().resolves({
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0,
        upsertedCount: 0,
        upsertedId: null,
      });

      const res = mockResponse();
      await adminUsers.changeRole(
        {
          body: { id: String(target._id), role: 'welcome-team' },
          user: admin,
        },
        res,
      );

      res.statusCode.should.equal(200);
      sinon.assert.calledTwice(updateOne);
      const updated = await User.findById(target._id).exec();
      assertPresent(updated, 'updated user');
      present(updated.roles, 'user roles').should.deepEqual([
        'user',
        'welcome-team',
      ]);
      present(updated.authVersion, 'user auth version').should.equal(1);
    });

    it('updates a legacy account whose roles field is absent', async () => {
      const [admin, target] = await utils.saveUsers(utils.generateUsers(2));
      await User.collection.updateOne(
        { _id: target._id },
        { $unset: { roles: '' } },
      );

      const res = mockResponse();
      await adminUsers.changeRole(
        {
          body: { id: String(target._id), role: 'welcome-team' },
          user: admin,
        },
        res,
      );

      responseField(res, 'message').should.equal('Role changed.');
      const updated = await User.findById(target._id).exec();
      assertPresent(updated, 'updated user');
      present(updated.roles, 'user roles').should.deepEqual(['welcome-team']);
    });

    it('returns 404 when the target user does not exist', async () => {
      const users = await utils.saveUsers(utils.generateUsers(1));
      const res = mockResponse();

      await adminUsers.changeRole(
        {
          body: {
            id: new mongoose.Types.ObjectId().toString(),
            role: 'suspended',
          },
          user: users[0],
        },
        res,
      );

      res.statusCode.should.equal(404);
      responseField(res, 'message').should.equal(
        errorService.getErrorMessageByKey('not-found'),
      );
    });

    it('rejects invalid roles', async () => {
      const users = await utils.saveUsers(utils.generateUsers(1));
      const res = mockResponse();

      await adminUsers.changeRole(
        {
          body: { id: users[0]._id.toString(), role: 'admin' },
          user: users[0],
        },
        res,
      );

      res.statusCode.should.equal(400);
      responseField(res, 'message').should.equal('Invalid role.');
    });

    it('rejects the legacy moderator role', async () => {
      const users = await utils.saveUsers(utils.generateUsers(1));
      const res = mockResponse();

      await adminUsers.changeRole(
        {
          body: { id: users[0]._id.toString(), role: 'moderator' },
          user: users[0],
        },
        res,
      );

      res.statusCode.should.equal(400);
      responseField(res, 'message').should.equal('Invalid role.');
    });

    it('rejects missing user ids', async () => {
      const users = await utils.saveUsers(utils.generateUsers(1));
      const res = mockResponse();

      await adminUsers.changeRole(
        {
          body: { role: 'suspended' },
          user: users[0],
        },
        res,
      );

      res.statusCode.should.equal(400);
      responseField(res, 'message').should.equal(
        errorService.getErrorMessageByKey('invalid-id'),
      );
    });

    it('shadowbans a user and removes suspended role', async () => {
      const users = await utils.saveUsers(utils.generateUsers(2));
      const target = users[1];
      target.roles = ['user', 'suspended'];
      await target.save();

      const res = mockResponse();
      await adminUsers.changeRole(
        {
          body: { id: target._id.toString(), role: 'shadowban' },
          user: users[0],
        },
        res,
      );

      const updated = await User.findById(target._id).exec();
      assertPresent(updated, 'updated user');
      present(updated.roles, 'user roles').should.containEql('shadowban');
      present(updated.roles, 'user roles').should.not.containEql('suspended');
    });

    it('removes a shadowban without changing other roles or profile settings', async () => {
      const users = await utils.saveUsers(utils.generateUsers(2));
      const target = users[1];
      target.roles = ['user', 'shadowban', 'suspended', 'volunteer'];
      target.public = true;
      target.newsletter = true;
      await target.save();
      const hiddenMessage = await new Message({
        content: 'Earlier hidden message.',
        userFrom: target._id,
        userTo: users[0]._id,
        read: true,
        shadowHidden: true,
      }).save();

      const res = mockResponse();
      await adminUsers.changeRole(
        {
          body: {
            id: target._id.toString(),
            role: 'shadowban',
            action: 'remove',
          },
          user: users[0],
        },
        res,
      );

      res.statusCode.should.equal(200);
      const updated = await User.findById(target._id).exec();
      assertPresent(updated, 'updated user');
      present(updated.roles, 'user roles').should.deepEqual([
        'user',
        'suspended',
        'volunteer',
      ]);
      present(updated.public, 'user public setting').should.be.true();
      present(updated.newsletter, 'user newsletter setting').should.be.true();
      const oldMessage = await Message.findById(hiddenMessage._id).exec();
      oldMessage.shadowHidden.should.be.true();
      const recipientThread = await Thread.findOne({
        userFrom: target._id,
        userTo: users[0]._id,
      }).exec();
      should.not.exist(recipientThread);
      const note = await AdminNote.findOne({ user: target._id }).exec();
      note.note.should.equal(
        '<p><b>Performed action:</b></p><p><i>User unshadowbanned.</i></p>',
      );
    });

    it('rejects removal of unsupported moderation roles', async () => {
      const users = await utils.saveUsers(utils.generateUsers(1));
      const res = mockResponse();

      await adminUsers.changeRole(
        {
          body: {
            id: users[0]._id.toString(),
            role: 'suspended',
            action: 'remove',
          },
          user: users[0],
        },
        res,
      );

      res.statusCode.should.equal(400);
      responseField(res, 'message').should.equal('Invalid role.');
    });

    it('suspends a user and removes shadowban role', async () => {
      const users = await utils.saveUsers(utils.generateUsers(2));
      const target = users[1];
      target.roles = ['user', 'shadowban'];
      await target.save();

      const res = mockResponse();
      await adminUsers.changeRole(
        {
          body: { id: target._id.toString(), role: 'suspended' },
          user: users[0],
        },
        res,
      );

      const updated = await User.findById(target._id).exec();
      assertPresent(updated, 'updated user');
      present(updated.roles, 'user roles').should.containEql('suspended');
      present(updated.roles, 'user roles').should.not.containEql('shadowban');
      present(updated.public, 'user public setting').should.be.false();
    });

    it('returns 400 when updating a role fails', async () => {
      const users = await utils.saveUsers(utils.generateUsers(2));
      sinon.stub(User, 'updateOne').rejects(new Error('update failed'));

      const res = mockResponse();
      await adminUsers.changeRole(
        {
          body: { id: users[1]._id.toString(), role: 'suspended' },
          user: users[0],
        },
        res,
      );

      res.statusCode.should.equal(400);
    });
  });

  describe('usernameToUserId', () => {
    for (const username of [null, 42, [], { $ne: null }]) {
      it(`rejects a non-string username ${JSON.stringify(
        username,
      )}`, async () => {
        const find = sinon.spy(User, 'findOne');
        const res = mockResponse();
        const next = sinon.spy();
        await adminUsers.usernameToUserId({ body: { username } }, res, next);
        await res.waitForResponse();
        res.statusCode.should.equal(400);
        find.called.should.be.false();
        next.called.should.be.false();
      });
    }
    it('rejects structured and oversized usernames before looking up an account', async () => {
      const find = sinon.spy(User, 'findOne');
      for (const username of [
        { $ne: null },
        ['sample-member'],
        null,
        12,
        'a'.repeat(321),
      ]) {
        const res = mockResponse();
        const next = sinon.spy();
        await adminUsers.usernameToUserId({ body: { username } }, res, next);
        res.statusCode.should.equal(400);
        next.called.should.be.false();
      }
      find.called.should.be.false();
    });
    it('attaches a user id when the username exists', async () => {
      const users = await utils.saveUsers(utils.generateUsers(1));
      const req: {
        body: { username: string };
        userIdFromUsername?: import('mongoose').Types.ObjectId;
      } = { body: { username: users[0].username } };
      let nextCalled = false;

      await adminUsers.usernameToUserId(req, {}, () => {
        nextCalled = true;
      });

      nextCalled.should.equal(true);
      present(req.userIdFromUsername, 'resolved user id')
        .toString()
        .should.equal(users[0]._id.toString());
    });

    it('continues when the username is missing', async () => {
      const req: {
        body: Record<string, never>;
        userIdFromUsername?: import('mongoose').Types.ObjectId;
      } = { body: {} };
      let nextCalled = false;

      await adminUsers.usernameToUserId(req, {}, () => {
        nextCalled = true;
      });

      nextCalled.should.equal(true);
      should.not.exist(req.userIdFromUsername);
    });

    it('continues when the username does not match a user', async () => {
      const req: {
        body: { username: string };
        userIdFromUsername?: import('mongoose').Types.ObjectId;
      } = { body: { username: 'missing-user' } };
      let nextCalled = false;

      await adminUsers.usernameToUserId(req, {}, () => {
        nextCalled = true;
      });

      nextCalled.should.equal(true);
      should.not.exist(req.userIdFromUsername);
    });
  });
});
