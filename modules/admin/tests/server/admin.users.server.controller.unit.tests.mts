import mongoose from 'mongoose';
import sinon from 'sinon';
import adminUsers from './../../server/controllers/admin.users.server.controller.mts';
import errorService from './../../../core/server/services/error.server.service.mts';
import * as utils from '../../../../testutils/server/data.server.testutil.mts';
import should from 'should';
import mockModule from '../../../../testutils/server/mock-module.mts';

/**
 * Unit tests for uncovered admin users controller paths.
 */

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
const saveMembers = (count: number) =>
  utils.saveUsersWithCachedPasswords(
    utils.generateUsersWithSharedPassword(count),
  );
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
      should(res.body).deepEqual({
        message: errorService.getErrorMessageByKey('default'),
      });
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
      const users = await saveMembers(1);
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
      const users = await saveMembers(1);
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
      const users = await saveMembers(1);
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
      const users = await saveMembers(2);
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
      const users = await saveMembers(1);
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
      const users = await saveMembers(8);
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
      const users = await saveMembers(1);
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
      const users = await saveMembers(1);
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
      const [admin, target] = await saveMembers(2);
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

    it('validates role changes from an actor with a missing role list', async () => {
      const [actor] = await saveMembers(1);
      actor.set('roles', undefined);
      const res = mockResponse();

      await adminUsers.changeRole(
        { body: { role: 'unknown' }, user: actor },
        res,
      );

      res.statusCode.should.equal(400);
      responseField(res, 'message').should.equal('Invalid role.');
    });

    it('promotes a volunteer and removes volunteer-alumni', async () => {
      const users = await saveMembers(2);
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
      const users = await saveMembers(2);
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
      const [admin, target] = await saveMembers(2);
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
      const [admin, target] = await saveMembers(2);
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
      const [admin, target] = await saveMembers(2);
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
      const users = await saveMembers(1);
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
      const users = await saveMembers(1);
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
      const users = await saveMembers(1);
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
      const users = await saveMembers(1);
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
      const users = await saveMembers(2);
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
      const users = await saveMembers(2);
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
      const users = await saveMembers(1);
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
      const users = await saveMembers(2);
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
      const users = await saveMembers(2);
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
      const users = await saveMembers(1);
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

describe('Admin users controller with stored members', () => {
  /**
   * Unit tests for the admin users controller, run against stored members.
   */

  type UsersController =
    typeof import('../../server/controllers/admin.users.server.controller.mts').default;

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

  async function loadWithLogger(logged: LogEntry[]): Promise<UsersController> {
    return (
      await mockModule<{ default: UsersController }>(
        new URL(
          './../../server/controllers/admin.users.server.controller.mts',
          import.meta.url,
        ),
        {
          '@trustroots/logger': (
            level: string,
            message: string,
            detail: unknown,
          ) => {
            logged.push({ level, message, detail });
          },
        },
      )
    ).default;
  }

  async function getUser(id: unknown, extra: Record<string, unknown> = {}) {
    const res = mockResponse();
    await adminUsers.getUser({ body: { id, ...extra } }, res);
    return res;
  }

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
      const controller = await loadWithLogger([]);
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
        const controller = await loadWithLogger(logged);
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
