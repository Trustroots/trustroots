/**
 * Unit tests for the profile controller's guard, validation and middleware
 * branches that the route tests do not exercise. Handlers are invoked directly
 * with mock req/res/next against the test database.
 */
const crypto: typeof import('crypto') = require('crypto');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');

require('./../../server/models/user.server.model.mjs');
const profileController = require('./../../server/controllers/users.profile.server.controller.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
const should = require('should');

type BaseProfileUserDocument =
  import('../../../../testutils/server/model-contracts.mts').UserModelDocument;
type ProfileUserDocument = Omit<
  BaseProfileUserDocument,
  'additionalProvidersData'
> & {
  additionalProvidersData?: Record<string, unknown>;
  pushRegistration?: Array<{ platform: string; token: string; created: Date }>;
};
const User = mongoose.model<
  import('../../../../testutils/server/model-contracts.mts').UserRecord,
  import('../../../../testutils/server/model-contracts.mts').UserModel
>('User');
async function findUser(id: unknown): Promise<ProfileUserDocument> {
  const user = await User.findById(id);
  if (!user) throw new Error('Expected test user to exist');
  return user as ProfileUserDocument;
}
const Tribe = mongoose.model<
  import('../../../../testutils/server/model-contracts.mts').TribeRecord,
  import('../../../../testutils/server/model-contracts.mts').TribeModel
>('Tribe');
const UnifiedPushRegistration = mongoose.model('UnifiedPushRegistration');
const createPushRegistration = (user: unknown) =>
  UnifiedPushRegistration.create({
    user,
    endpoint: `https://ntfy.sh/anonymous-${String(user)}`,
    publicKey:
      'BNPRQG83KHuc4ZkSKlmSKQWC3PQm2YD-yOiPdjFbQyB8VM6ZZSLD2caRpXad6G_2qXqb_WUz7V2T7w1KqAXbslQ',
    auth: 'abcdefghijklmnopqrstuv',
  });

const nip19: typeof import('nostr-tools/nip19') = require('nostr-tools/nip19');
const validNpub =
  'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzqujme';

interface MockResponse {
  statusCode: number;
  body: unknown;
  _next: boolean;
  _nextArg: unknown;
  set(field: string, value: string): this;
  status(code: number): this;
  send(body: unknown): this;
  json(body: unknown): this;
}
interface HandlerOutcome {
  res: MockResponse;
  nextCalled: boolean;
  nextArg: unknown;
}
type Next = (arg?: unknown) => void;
type Handler = (res: MockResponse, next: Next) => void;

function runHandler(invoke: Handler): Promise<HandlerOutcome> {
  return new Promise(resolve => {
    const finish = (res: MockResponse): void =>
      resolve({ res, nextCalled: res._next, nextArg: res._nextArg });
    const res: MockResponse = {
      statusCode: 200,
      body: null,
      _next: false,
      _nextArg: undefined,
      set() {
        return res;
      },
      status(code) {
        res.statusCode = code;
        return res;
      },
      send(body) {
        res.body = body;
        finish(res);
        return res;
      },
      json(body) {
        res.body = body;
        finish(res);
        return res;
      },
    };
    const next: Next = arg => {
      res._next = true;
      res._nextArg = arg;
      finish(res);
    };
    invoke(res, next);
  });
}

function responseBody(res: MockResponse): Record<string, unknown> | unknown[] {
  if (typeof res.body !== 'object' || res.body === null)
    throw new Error('Expected response body');
  return res.body as Record<string, unknown> | unknown[];
}
function errorMessage(error: unknown): string {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('message' in error) ||
    typeof error.message !== 'string'
  )
    throw new Error('Expected an error message');
  return error.message;
}
function responseString(res: MockResponse, field: string): string {
  const body = responseBody(res);
  if (Array.isArray(body) || typeof body[field] !== 'string')
    throw new Error(`Expected string response field ${field}`);
  return body[field];
}
function responseFieldIsUndefined(res: MockResponse, field: string): boolean {
  const body = responseBody(res);
  return !Array.isArray(body) && body[field] === undefined;
}
function responseMemberLabel(res: MockResponse): string {
  const first = responseArray(res)[0];
  if (
    typeof first !== 'object' ||
    first === null ||
    !('tribe' in first) ||
    typeof first.tribe !== 'object' ||
    first.tribe === null ||
    !('label' in first.tribe) ||
    typeof first.tribe.label !== 'string'
  )
    throw new Error('Expected a populated tribe membership');
  return first.tribe.label;
}
function responseArray(res: MockResponse): unknown[] {
  const body = responseBody(res);
  if (!Array.isArray(body)) throw new Error('Expected array response');
  return body;
}

function assertFilterContains(filter: unknown, expected: unknown): void {
  if (
    typeof filter !== 'object' ||
    filter === null ||
    !('$and' in filter) ||
    !Array.isArray(filter.$and)
  )
    throw new Error('Expected an $and search filter');
  filter.$and.should.containEql(expected);
}
function stubSearch(
  assertFilter: (filter: unknown) => void,
  users: ProfileUserDocument[],
  error: Error | null = null,
): void {
  const query = {
    select: () => query,
    sort: () => query,
    limit: () => query,
    skip: () => query,
    maxTimeMS: (budget: number) => {
      budget.should.equal(2000);
      return {
        exec: (
          callback?: (
            error: Error | null,
            result: ProfileUserDocument[] | null,
          ) => void,
        ) => {
          if (typeof callback === 'function') {
            callback(error, error ? null : users);
            return undefined;
          }
          return error ? Promise.reject(error) : Promise.resolve(users);
        },
      };
    },
  };
  const fake = (filter: unknown) => {
    assertFilter(filter);
    return query;
  };
  sinon.stub(User, 'find').callsFake(fake as unknown as typeof User.find);
}

const controllerPath =
  './../../server/controllers/users.profile.server.controller.mjs';
const controllerModulePath =
  '../../server/controllers/users.profile.server.controller.mts';
const mockModule: typeof import('../../../../testutils/server/mock-module.mts').default = require('../../../../testutils/server/mock-module');
const emailServicePath =
  './../../../core/server/services/email.server.service.mjs';

function stubControllerDependencies<
  TDependencies extends Record<string, object>,
>(controllerPath: string, dependencyStubs: TDependencies) {
  for (const [dependencyPath, methods] of Object.entries(dependencyStubs)) {
    const dependency: Record<string, unknown> = require(dependencyPath);
    for (const [method, implementation] of Object.entries(methods)) {
      if (typeof implementation !== 'function')
        throw new TypeError(`Expected ${method} mock to be a function`);
      sinon
        .stub(dependency, method)
        .callsFake(implementation as (...args: never[]) => unknown);
    }
  }
  return require(controllerPath);
}

const statServicePath =
  './../../../stats/server/services/stats.server.service.mts';
function recordStats(): unknown[] {
  const stats: unknown[] = [];
  stubControllerDependencies(controllerPath, {
    [statServicePath]: {
      stat: (payload: unknown, cb: () => void) => {
        stats.push(payload);
        cb();
      },
    },
  });
  return stats;
}
const {
  usernameFormatMessage,
}: typeof import('../../server/services/authentication.server.service.mjs') = require('../../server/services/authentication.server.service.mjs');

describe('Profile controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  describe('deleteUserAccount', () => {
    it('fails closed when the account no longer matches the deletion criteria', async () => {
      sinon.stub(User, 'findOneAndDelete').resolves(null);
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.removeProfileToken = 'valid-remove-token';
      userDoc.removeProfileExpires = new Date(Date.now() + 3600000);
      await userDoc.save();
      const { res } = await runHandler(res =>
        profileController.removeProfile(
          { user: { _id: saved._id }, params: { token: 'valid-remove-token' } },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });
  });

  describe('deleteUserAccount cleanup', () => {
    const cleanupSteps = ['push', 'offers', 'contacts', 'email'] as const;
    type CleanupStep = (typeof cleanupSteps)[number];
    // A fresh controller whose logger records calls; the logger cannot be stubbed in place.
    function loadRemoval(failing?: CleanupStep) {
      const logs: unknown[][] = [];
      const error = new Error(`${failing} cleanup failed`);
      const done =
        (step: CleanupStep) =>
        (_id: unknown, cb: (error: Error | null) => void) =>
          cb(step === failing ? error : null);
      if (failing === 'push')
        sinon.stub(UnifiedPushRegistration, 'deleteMany').rejects(error);
      const controller = mockModule<typeof profileController>(
        require.resolve(controllerModulePath),
        {
          './../../../offers/server/controllers/offers.server.controller.mjs': {
            removeAllByUserId: done('offers'),
          },
          './../../../contacts/server/controllers/contacts.server.controller.mjs':
            { removeAllByUserId: done('contacts') },
          [emailServicePath]: { sendRemoveProfileConfirmed: done('email') },
          './../../../../config/lib/logger.mjs': (...args: unknown[]) =>
            logs.push(args),
        },
      );
      return { controller, logs, error };
    }

    for (const failing of [undefined, ...cleanupSteps]) {
      it(`removes the account and logs ${failing || 'no'} best-effort cleanup failure`, async () => {
        const [other, saved] = await utils.saveUsers(utils.generateUsers(2));
        await User.updateOne(
          { _id: saved._id },
          {
            removeProfileToken: 'remove-token',
            removeProfileExpires: new Date(Date.now() + 3600000),
          },
        );
        await createPushRegistration(other._id);
        const { controller, logs, error } = loadRemoval(failing);

        const { res } = await runHandler(res =>
          controller.removeProfile(
            { user: { _id: saved._id }, params: { token: 'remove-token' } },
            res,
          ),
        );

        res.statusCode.should.equal(200);
        logs.should.deepEqual(
          failing
            ? [
                [
                  'error',
                  'Account removed but related cleanup failed.',
                  { userId: String(saved._id), error },
                ],
              ]
            : [],
        );
        should.not.exist(await User.exists({ _id: saved._id }));
        if (failing !== 'push')
          (
            await UnifiedPushRegistration.countDocuments({ user: other._id })
          ).should.equal(1);
      });
    }

    it('builds the space-separated profile field lists when it loads', () => {
      const { controller } = loadRemoval();
      for (const [fields, field] of [
        [controller.userProfileFields, 'tagline'],
        [controller.userListingProfileFields, 'birthdate'],
        [controller.userSearchProfileFields, 'locationFrom'],
      ])
        fields.split(' ').should.containEql(field);
    });

    for (const roles of [['user'], ['suspended'], ['suspended', 'admin']]) {
      const suspended = roles.join() === 'suspended';
      it(`administrator deletion ${suspended ? 'removes' : 'refuses'} an account with roles ${roles}`, async () => {
        const { deleteUserAccount } =
          await import('../../server/controllers/users.profile.server.controller.mts');
        const [saved] = await utils.saveUsers(utils.generateUsers(1));
        await User.updateOne({ _id: saved._id }, { roles });
        const removal = deleteUserAccount(
          (await findUser(saved._id)) as unknown as Parameters<
            typeof deleteUserAccount
          >[0],
          true,
        );
        if (suspended)
          (await removal).should.deepEqual({ cleanupIncomplete: false });
        else
          await should(removal).be.rejectedWith(
            'Account changed or was already deleted. Refresh the member report.',
          );
        Boolean(await User.exists({ _id: saved._id })).should.equal(!suspended);
      });
    }
  });

  describe('profile removal status and cancellation', () => {
    for (const method of ['getProfileRemovalStatus', 'cancelProfileRemoval']) {
      it(`${method} refuses an unauthenticated caller`, async () => {
        const { res } = await runHandler(res =>
          profileController[method]({}, res),
        );
        res.statusCode.should.equal(403);
      });

      it(`${method} only reads and changes the caller's own request`, async () => {
        const [other, user] = await utils.saveUsers(utils.generateUsers(2));
        const pending = {
          removeProfileExpires: new Date(Date.now() + 3600000),
        };
        await User.updateOne(
          { _id: other._id },
          { ...pending, removeProfileToken: 'other-token' },
        );
        await User.updateOne(
          { _id: user._id },
          { ...pending, removeProfileToken: '' },
        );
        const { res } = await runHandler(res =>
          profileController[method]({ user }, res),
        );
        responseBody(res).should.deepEqual({ pending: false });
        should.exist((await findUser(other._id)).removeProfileToken);
      });

      it(`${method} reports database failures`, async () => {
        const [user] = await utils.saveUsers(utils.generateUsers(1));
        sinon
          .stub(
            User,
            method === 'getProfileRemovalStatus' ? 'exists' : 'updateOne',
          )
          .rejects(new Error('Fictional database failure'));
        const { res } = await runHandler(res =>
          profileController[method]({ user }, res),
        );
        res.statusCode.should.equal(400);
      });
    }
  });

  describe('update', () => {
    let userDoc: ProfileUserDocument;

    beforeEach(async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      userDoc = await findUser(saved._id);
    });

    it('responds with 403 without a user', async () => {
      const { res } = await runHandler(res =>
        profileController.update({ body: {} }, res),
      );
      res.statusCode.should.equal(403);
    });

    const rejections: Array<[string, Record<string, unknown>, string]> = [
      [
        'a level for an unselected language on a legacy profile',
        { languageLevels: { eng: 'basic' } },
        'Please select valid levels for your profile languages.',
      ],
      [
        'a malformed email address',
        { email: 'not-an-email' },
        'Please enter a valid email address.',
      ],
      ['a non-string username', { username: 42 }, usernameFormatMessage],
    ];
    for (const [label, body, message] of rejections) {
      it(`rejects ${label}`, async () => {
        userDoc.languages = undefined;
        const { res } = await runHandler(res =>
          profileController.update({ user: userDoc, body }, res),
        );
        res.statusCode.should.equal(400);
        responseBody(res).should.deepEqual({ message });
        // Rejected before any change is staged on the signed-in member.
        (userDoc.emailTemporary || '').should.equal('');
      });
    }

    it('keeps levels of the saved languages when the request omits languages', async () => {
      userDoc.languages = ['eng'];
      await userDoc.save();
      const { res } = await runHandler(res =>
        profileController.update(
          { user: userDoc, body: { languageLevels: { eng: 'basic' } } },
          res,
        ),
      );
      res.statusCode.should.equal(200);
      (await findUser(userDoc._id))
        .get('languageLevels')
        .should.deepEqual({ eng: 'basic' });
    });

    it('only trims levels when languages arrive as a list', async () => {
      userDoc.languages = ['eng', 'ger'];
      userDoc.set('languageLevels', { eng: 'basic', ger: 'native' });
      await userDoc.save();
      const { res } = await runHandler(res =>
        profileController.update(
          { user: userDoc, body: { languages: 'eng' } },
          res,
        ),
      );
      res.statusCode.should.equal(200);
      (await findUser(userDoc._id))
        .get('languageLevels')
        .should.deepEqual({ eng: 'basic', ger: 'native' });
    });

    it('updates languages on a legacy profile without language levels', async () => {
      userDoc.set('languageLevels', undefined);
      should.not.exist(userDoc.get('languageLevels'));

      const { res } = await runHandler(res =>
        profileController.update(
          {
            user: userDoc,
            body: { languages: ['eng'] },
            login: (_user: unknown, cb: () => void) => cb(),
          },
          res,
        ),
      );

      res.statusCode.should.equal(200);
      const saved = await findUser(userDoc._id);
      should(saved.languages).deepEqual(['eng']);
      (saved.get('languageLevels') || {}).should.deepEqual({});
    });

    it('rejects an invalid locale', async () => {
      const { res } = await runHandler(res =>
        profileController.update(
          { user: userDoc, body: { locale: 'not-a-locale' } },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('rejects a non-string nostrNpub', async () => {
      const { res } = await runHandler(res =>
        profileController.update(
          { user: userDoc, body: { nostrNpub: { evil: true } } },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    for (const nostrNpub of [
      'npub-not-valid',
      nip19.noteEncode('ab'.repeat(32)),
      nip19.encodeBytes('npub', new Uint8Array(33).fill(1)),
    ]) {
      it(`rejects the nostr key ${nostrNpub.slice(0, 12)}…`, async () => {
        const { res } = await runHandler(res =>
          profileController.update({ user: userDoc, body: { nostrNpub } }, res),
        );
        res.statusCode.should.equal(400);
      });
    }

    it('accepts a valid nostrNpub', async () => {
      const { res } = await runHandler(res =>
        profileController.update(
          {
            user: userDoc,
            body: { nostrNpub: validNpub },
            login: (_user: unknown, cb: () => void) => cb(),
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);
      responseString(res, 'nostrNpub').should.equal(validNpub);
    });

    it('returns 400 when checking nostr npub availability fails', async () => {
      sinon.stub(User, 'findOne').rejects(new Error('lookup failed'));

      const { res } = await runHandler(res =>
        profileController.update(
          {
            user: userDoc,
            body: { nostrNpub: validNpub },
            login: (_user: unknown, cb: () => void) => cb(),
          },
          res,
        ),
      );

      res.statusCode.should.equal(400);
    });

    it('blocks username changes before the cooldown expires', async () => {
      userDoc.created = new Date();
      await userDoc.save();

      const { res } = await runHandler(res =>
        profileController.update(
          {
            user: userDoc,
            body: { username: 'brandnewusername' },
            login: (_user: unknown, cb: () => void) => cb(),
          },
          res,
        ),
      );
      res.statusCode.should.equal(403);
      responseString(res, 'message').should.equal(
        'You cannot change your username at this time.',
      );
    });

    const updateUsername = (username = 'brandnewusername') =>
      runHandler(res =>
        profileController.update({ user: userDoc, body: { username } }, res),
      );
    const stubReload = (exec: import('sinon').SinonStub) => {
      const query = { select: () => query, exec };
      sinon
        .stub(User, 'findById')
        .returns(query as unknown as ReturnType<typeof User.findById>);
    };

    it('returns not found if the account disappears before a username change', async () => {
      await User.deleteOne({ _id: userDoc._id });
      const { res } = await updateUsername();
      res.statusCode.should.equal(404);
      responseBody(res).should.deepEqual({ message: 'User not found.' });
    });

    it('saves an unchanged username without reloading the account', async () => {
      await User.deleteOne({ _id: userDoc._id });
      const { res } = await updateUsername(userDoc.username);
      // The vanished account fails to save instead of answering not found.
      res.statusCode.should.equal(400);
    });

    it('accepts the username already saved by a concurrent request', async () => {
      userDoc.created = new Date('2020-01-01');
      await userDoc.save();
      const currentUsername = userDoc.username;
      userDoc.username = 'staleusername';

      const { res } = await updateUsername(currentUsername);

      res.statusCode.should.equal(200);
      responseString(res, 'username').should.equal(currentUsername);
      const saved = await User.findById(userDoc._id).select('+usernameHistory');
      if (!saved) throw new Error('Expected the saved user');
      (saved.usernameHistory || []).should.have.length(0);
    });

    it('answers a conflict when another request renamed the account first', async () => {
      userDoc.created = new Date('2020-01-01');
      await userDoc.save();
      await User.updateOne(
        { _id: userDoc._id },
        { username: 'renamedelsewhere' },
      );
      stubReload(sinon.stub().resolves(userDoc));
      const { res } = await updateUsername();
      res.statusCode.should.equal(409);
      responseBody(res).should.deepEqual({
        message: 'Your username changed in another request. Please try again.',
      });
      should.exist(
        await User.exists({ _id: userDoc._id, username: 'renamedelsewhere' }),
      );
    });

    const usernameFailures: Array<[string, () => void, number]> = [
      [
        'reloading the account fails',
        () => stubReload(sinon.stub().rejects(new Error('lookup failed'))),
        400,
      ],
      [
        'a concurrent save wins the version check',
        () => {
          stubReload(sinon.stub().resolves(userDoc));
          sinon
            .stub(userDoc, 'save')
            .rejects(
              new mongoose.Error.VersionError(userDoc, userDoc.__v, [
                'username',
              ]),
            );
        },
        409,
      ],
      [
        'saving fails for another reason',
        () => {
          stubReload(sinon.stub().resolves(userDoc));
          sinon.stub(userDoc, 'save').rejects(new Error('save failed'));
        },
        400,
      ],
    ];
    for (const [label, arrange, status] of usernameFailures) {
      it(`answers ${status} when ${label}`, async () => {
        userDoc.created = new Date('2020-01-01');
        arrange();
        const { res } = await updateUsername();
        res.statusCode.should.equal(status);
      });
    }

    it('rejects an email already used by someone else', async () => {
      const [other] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      const otherDoc = await findUser(other._id);

      const { res } = await runHandler(res =>
        profileController.update(
          { user: userDoc, body: { email: otherDoc.email }, login: () => {} },
          res,
        ),
      );
      res.statusCode.should.equal(403);
    });

    it('updates a simple field and the update time', async () => {
      const before = new Date('2020-01-01');
      await User.updateOne({ _id: userDoc._id }, { updated: before });
      const { res } = await runHandler(res =>
        profileController.update(
          { user: userDoc, body: { tagline: 'New tagline' } },
          res,
        ),
      );
      res.statusCode.should.equal(200);
      responseString(res, 'tagline').should.equal('New tagline');
      (await findUser(userDoc._id)).get('updated').should.be.above(before);
    });

    for (const field of ['tagline', 'email']) {
      it(`does no email-change work when saving the ${field === 'email' ? 'current email' : 'tagline'}`, async () => {
        const body = { [field]: userDoc.get(field) || 'New tagline' };
        // Another member already holds the address: only a lookup would see it.
        const lookup = sinon
          .stub(User, 'findOne')
          .resolves(
            new User({ _id: new mongoose.Types.ObjectId() }) as Awaited<
              ReturnType<typeof User.findOne>
            >,
          );
        const sendConfirmation = sinon.spy();
        const controller = stubControllerDependencies(controllerPath, {
          [emailServicePath]: { sendChangeEmailConfirmation: sendConfirmation },
        });
        const { res } = await runHandler(res =>
          controller.update({ user: userDoc, body }, res),
        );
        res.statusCode.should.equal(200);
        sendConfirmation.called.should.be.false();
        lookup.restore();
        ((await findUser(userDoc._id)).emailTemporary || '').should.equal('');
      });
    }

    for (const field of ['email', 'emailTemporary']) {
      it(`matches another member's ${field} case-insensitively`, async () => {
        const [other] = await utils.saveUsers(utils.generateUsers(1));
        await User.updateOne(
          { _id: other._id },
          { [field]: 'taken-address@example.com' },
        );
        const { res } = await runHandler(res =>
          profileController.update(
            { user: userDoc, body: { email: 'Taken-Address@Example.com' } },
            res,
          ),
        );
        res.statusCode.should.equal(403);
      });
    }

    it('allows resubmitting a pending email change address', async () => {
      userDoc.emailTemporary = 'pending-change@example.com';
      await userDoc.save();

      const { res } = await runHandler(res =>
        profileController.update(
          {
            user: userDoc,
            body: { email: 'pending-change@example.com' },
            login: (_user: unknown, cb: () => void) => cb(),
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);
    });

    it('preserves the authenticated session when saving a profile', async () => {
      const login = sinon.spy();
      const { res } = await runHandler(res =>
        profileController.update(
          { user: userDoc, body: { tagline: 'Updated tagline' }, login },
          res,
        ),
      );
      res.statusCode.should.equal(200);
      login.called.should.equal(false);
    });

    it('keeps derived and server-managed fields when applying profile edits', async () => {
      userDoc.lastIpHash = '192.0.2.10';
      userDoc.providerData = { id: 'sample-provider' };
      await userDoc.save();
      const previousName = userDoc.displayName;
      const { res } = await runHandler(res =>
        profileController.update(
          {
            user: userDoc,
            body: {
              tagline: 'A normal edit',
              displayName: 'Unrelated name',
              lastIpHash: '198.51.100.20',
              providerData: { id: 'replacement' },
              roles: ['admin'],
              public: false,
              _doc: { roles: ['admin'] },
            },
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);
      const saved = await findUser(userDoc._id);
      saved.tagline!.should.equal('A normal edit');
      saved.displayName!.should.equal(previousName);
      saved.lastIpHash!.should.equal('192.0.2.10');
      saved.providerData!.should.deepEqual({ id: 'sample-provider' });
      saved.roles!.should.not.containEql('admin');
    });

    it('returns 400 when saving profile updates fails', async () => {
      sinon.stub(userDoc, 'save').rejects(new Error('save failed'));

      const { res } = await runHandler(res =>
        profileController.update(
          {
            user: userDoc,
            body: { tagline: 'Updated tagline' },
            login: (_user: unknown, cb: () => void) => cb(),
          },
          res,
        ),
      );

      res.statusCode.should.equal(400);
    });

    it('reports failure to generate an email-change token', async () => {
      sinon
        .stub(crypto, 'randomBytes')
        .callsFake((size, cb) =>
          cb(new Error('Entropy unavailable'), Buffer.alloc(size)),
        );
      const { res } = await runHandler(res =>
        profileController.update(
          { user: userDoc, body: { email: 'sample-new@example.com' } },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('reports failure to deliver the email-change confirmation', async () => {
      const controller = stubControllerDependencies(controllerPath, {
        [emailServicePath]: {
          sendChangeEmailConfirmation: (
            _user: unknown,
            cb: (err: Error) => void,
          ) => cb(new Error('Email unavailable')),
        },
      });
      const { res } = await runHandler(res =>
        controller.update(
          { user: userDoc, body: { email: 'sample-new@example.com' } },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('changes the email and triggers a confirmation token', async () => {
      const { res } = await runHandler(res =>
        profileController.update(
          {
            user: userDoc,
            body: { email: 'brand-new-email@example.com' },
            login: (_user: unknown, cb: () => void) => cb(),
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);

      const reloaded = await findUser(userDoc._id);
      reloaded.emailTemporary!.should.equal('brand-new-email@example.com');
      reloaded.emailToken!.should.match(/^sha256:[a-f0-9]{64}$/);
      reloaded.emailTokenIssuedAt!.should.be.a.Date();
      reloaded
        .emailTokenExpires!.getTime()
        .should.equal(
          reloaded.emailTokenIssuedAt!.getTime() + 24 * 60 * 60 * 1000,
        );
    });
  });

  describe('initializeRemoveProfile', () => {
    it('responds with 403 without a user', async () => {
      const { res } = await runHandler(res =>
        profileController.initializeRemoveProfile({}, res),
      );
      res.statusCode.should.equal(403);
    });

    for (const role of ['suspended', 'shadowban']) {
      it(`responds with 403 for ${role} users`, async () => {
        const { res } = await runHandler(res =>
          profileController.initializeRemoveProfile(
            { user: { _id: new mongoose.Types.ObjectId(), roles: [role] } },
            res,
          ),
        );
        res.statusCode.should.equal(403);
      });
    }

    it('stores a day-long removal token on the requesting member only', async () => {
      const [other, saved] = await utils.saveUsers(utils.generateUsers(2));
      const userDoc = await findUser(saved._id);
      const stats = recordStats();
      const before = Date.now();

      const { res } = await runHandler(res =>
        profileController.initializeRemoveProfile({ user: userDoc }, res),
      );

      res.statusCode.should.equal(200);
      responseBody(res).should.deepEqual({
        message: 'We sent you an email with further instructions.',
      });
      stats.should.deepEqual([
        {
          namespace: 'profileRemoval',
          counts: { count: 1 },
          tags: { status: 'emailSent' },
        },
      ]);
      const reloaded = await findUser(saved._id);
      should.exist(reloaded.removeProfileToken);
      reloaded
        .removeProfileExpires!.getTime()
        .should.be.within(before + 24 * 3600000, Date.now() + 24 * 3600000);
      should.not.exist((await findUser(other._id)).removeProfileToken);
    });

    it('still answers when the account vanished before the token was stored', async () => {
      const controller = stubControllerDependencies(controllerPath, {
        [emailServicePath]: {
          sendRemoveProfile: (_user: unknown, cb: () => void) => cb(),
        },
      });
      const { res } = await runHandler(res =>
        controller.initializeRemoveProfile(
          { user: { _id: new mongoose.Types.ObjectId(), roles: [] } },
          res,
        ),
      );
      res.statusCode.should.equal(200);
    });

    it('returns 400 when sending the removal email fails', async () => {
      const controller = stubControllerDependencies(controllerPath, {
        [emailServicePath]: {
          sendRemoveProfile: (_user: unknown, cb: (error: Error) => void) =>
            cb(new Error('smtp down')),
        },
      });
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);

      const { res } = await runHandler(res =>
        controller.initializeRemoveProfile({ user: userDoc }, res),
      );
      res.statusCode.should.equal(400);
      responseBody(res).should.deepEqual({
        message:
          'Failure while sending confirmation email to you. Please try again later.',
      });
    });

    it('returns 400 without sending a removal email when token persistence fails', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      sinon
        .stub(User, 'findOneAndUpdate')
        .rejects(new Error('storage unavailable'));
      const { res } = await runHandler(res =>
        profileController.initializeRemoveProfile({ user: userDoc }, res),
      );
      res.statusCode.should.equal(400);
      responseString(res, 'message').should.equal(
        'Removing your profile failed.',
      );
    });

    it('returns 400 when generating the removal token fails', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      sinon.stub(crypto, 'randomBytes').callsFake((size, cb) => {
        cb(new Error('entropy unavailable'), Buffer.alloc(size));
      });

      const { res } = await runHandler(res =>
        profileController.initializeRemoveProfile({ user: userDoc }, res),
      );

      res.statusCode.should.equal(400);
      responseString(res, 'message').should.equal(
        'Removing your profile failed.',
      );
    });

    it('sends the removal token only after it is persisted', async () => {
      const [created] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(created._id);
      const emailService: typeof import('../../../core/server/services/email.server.service.mjs') = require(
        emailServicePath,
      );
      const send = sinon
        .stub(emailService, 'sendRemoveProfile')
        .callsFake((_user, cb) => cb());
      const { res } = await runHandler(res =>
        profileController.initializeRemoveProfile({ user: userDoc }, res),
      );
      res.statusCode.should.equal(200);
      send.calledOnce.should.be.true();
      const saved = await findUser(userDoc._id);
      should.exist(saved.removeProfileToken);
    });
  });

  describe('removeProfile', () => {
    it('responds with 403 without a user', async () => {
      const { res } = await runHandler(res =>
        profileController.removeProfile({}, res),
      );
      res.statusCode.should.equal(403);
    });

    const outcomes: Array<[string, boolean, string, string]> = [
      [
        'wrong-token',
        false,
        'failed',
        'Profile remove token is invalid or has expired.',
      ],
      ['remove-token', true, 'failed', 'Removing your profile failed.'],
      ['remove-token', false, 'removed', 'Your profile has been removed.'],
    ];
    for (const [token, deletionFails, status, message] of outcomes) {
      it(`reports "${message}" to the member and stats`, async () => {
        const [saved] = await utils.saveUsers(utils.generateUsers(1));
        await User.updateOne(
          { _id: saved._id },
          {
            removeProfileToken: 'remove-token',
            removeProfileExpires: new Date(Date.now() + 3600000),
          },
        );
        if (deletionFails)
          sinon.stub(User, 'findOneAndDelete').rejects(new Error('db down'));
        const stats = recordStats();
        const { res } = await runHandler(res =>
          profileController.removeProfile(
            { user: { _id: saved._id }, params: { token } },
            res,
          ),
        );
        res.statusCode.should.equal(status === 'removed' ? 200 : 400);
        responseBody(res).should.deepEqual({ message });
        stats.should.deepEqual([
          {
            namespace: 'profileRemoval',
            counts: { count: 1 },
            tags: { status },
          },
        ]);
      });
    }

    it('removes the profile when the token is valid', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.removeProfileToken = 'valid-remove-token';
      userDoc.removeProfileExpires = new Date(Date.now() + 3600000);
      await userDoc.save();
      await createPushRegistration(saved._id);

      const { res } = await runHandler(res =>
        profileController.removeProfile(
          {
            user: { _id: saved._id },
            params: { token: 'valid-remove-token' },
          },
          res,
        ),
      );

      res.statusCode.should.equal(200);
      responseString(res, 'message').should.equal(
        'Your profile has been removed.',
      );

      const gone = await User.findById(saved._id);
      should.not.exist(gone);
      (
        await UnifiedPushRegistration.countDocuments({ user: saved._id })
      ).should.equal(0);
    });

    it('returns 400 when profile removal fails in the waterfall', async () => {
      const messageHandlerPath =
        './../../../messages/server/controllers/messages.server.controller.mjs';
      const controller = stubControllerDependencies(controllerPath, {
        [messageHandlerPath]: {
          markAllMessagesToUserNotified: (
            _userId: unknown,
            cb: (error: Error) => void,
          ) => cb(new Error('messages failed')),
        },
      });

      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.removeProfileToken = 'valid-remove-token';
      userDoc.removeProfileExpires = new Date(Date.now() + 3600000);
      await userDoc.save();

      const { res } = await runHandler(res =>
        controller.removeProfile(
          {
            user: { _id: saved._id },
            params: { token: 'valid-remove-token' },
          },
          res,
        ),
      );

      res.statusCode.should.equal(400);
      responseString(res, 'message').should.equal(
        'Removing your profile failed.',
      );
    });

    it('reports upload deletion failures without leaving the request pending', async () => {
      const removeLocalPath = sinon.stub().rejects(new Error('uploads failed'));
      const controller = stubControllerDependencies(controllerPath, {
        '../../../core/server/services/file-removal.server.service.mjs': {
          removeLocalPath,
        },
      });
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.removeProfileToken = 'fictional-remove-token';
      userDoc.removeProfileExpires = new Date(Date.now() + 3600000);
      await userDoc.save();

      const { res } = await runHandler(res =>
        controller.removeProfile(
          {
            user: { _id: saved._id },
            params: { token: 'fictional-remove-token' },
          },
          res,
        ),
      );
      sinon.assert.calledOnce(removeLocalPath);
      res.statusCode.should.equal(400);
      responseString(res, 'message').should.equal(
        'Removing your profile failed.',
      );
    });

    it('reports membership counter failures during profile removal', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.removeProfileToken = 'sample-remove-token';
      userDoc.removeProfileExpires = new Date(Date.now() + 3600000);
      userDoc.member = [
        { tribe: new mongoose.Types.ObjectId(), since: new Date() },
      ];
      await userDoc.save();
      const controller = stubControllerDependencies(controllerPath, {
        './../../../tribes/server/controllers/tribes.server.controller.mjs': {
          updateCount: (
            _id: unknown,
            _change: number,
            _returnUpdated: boolean,
            cb: (err: Error) => void,
          ) => cb(new Error('Counter unavailable')),
        },
      });
      const { res } = await runHandler(res =>
        controller.removeProfile(
          { user: userDoc, params: { token: 'sample-remove-token' } },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('reports a failed removal-token lookup', async () => {
      sinon.stub(User, 'findOne').rejects(new Error('Lookup unavailable'));
      const { res } = await runHandler(res =>
        profileController.removeProfile(
          {
            user: { _id: new mongoose.Types.ObjectId() },
            params: { token: 'sample-token' },
          },
          res,
        ),
      );
      res.statusCode.should.equal(400);
      responseString(res, 'message').should.equal(
        'Profile remove token is invalid or has expired.',
      );
    });
  });

  describe('getUser', () => {
    it('returns another user profile without the public field', async () => {
      const ownId = new mongoose.Types.ObjectId();
      const { res } = await runHandler(res =>
        profileController.getUser(
          {
            user: { _id: ownId },
            profile: { _id: new mongoose.Types.ObjectId(), public: true },
          },
          res,
        ),
      );
      responseFieldIsUndefined(res, 'public').should.be.true();
    });

    it('returns the own profile', async () => {
      const id = new mongoose.Types.ObjectId();
      const { res } = await runHandler(res =>
        profileController.getUser(
          { user: { _id: id }, profile: { _id: id } },
          res,
        ),
      );
      responseBody(res).should.be.an.Object();
    });

    it('returns an empty object without a profile', async () => {
      const { res } = await runHandler(res =>
        profileController.getUser(
          { user: { _id: new mongoose.Types.ObjectId() } },
          res,
        ),
      );
      responseBody(res).should.deepEqual({});
    });
  });

  describe('getMiniUser', () => {
    it('returns the profile without public and roles', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const profile = await findUser(saved._id);
      const { res } = await runHandler(res =>
        profileController.getMiniUser({ profile }, res),
      );
      responseFieldIsUndefined(res, 'public').should.be.true();
      responseFieldIsUndefined(res, 'roles').should.be.true();
    });

    it('returns an empty object without a profile', async () => {
      const { res } = await runHandler(res =>
        profileController.getMiniUser({}, res),
      );
      responseBody(res).should.deepEqual({});
    });
  });

  describe('userMiniByID', () => {
    it('includes avatarVersion in mini-profile query fields', () => {
      profileController.userMiniProfileFields
        .split(/\s+/)
        .should.containEql('avatarVersion');
    });

    it('responds with 400 for an invalid id', async () => {
      const { res } = await runHandler((res, next) =>
        profileController.userMiniByID({ user: {} }, res, next, 'bad-id'),
      );
      res.statusCode.should.equal(400);
    });

    it('responds with 404 for a missing user', async () => {
      const { res } = await runHandler((res, next) =>
        profileController.userMiniByID(
          { user: { _id: new mongoose.Types.ObjectId(), roles: [] } },
          res,
          next,
          new mongoose.Types.ObjectId().toString(),
        ),
      );
      res.statusCode.should.equal(404);
    });

    it('responds with 404 for a suspended profile', async () => {
      const [viewer] = await utils.saveUsers(utils.generateUsers(1));
      const [target] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      const targetDoc = await findUser(target._id);
      targetDoc.roles = ['suspended'];
      await targetDoc.save();

      const { res } = await runHandler((res, next) =>
        profileController.userMiniByID(
          { user: { _id: viewer._id, roles: ['user'] } },
          res,
          next,
          target._id.toString(),
        ),
      );
      res.statusCode.should.equal(404);
    });

    it('calls next for a valid public profile', async () => {
      const [viewer] = await utils.saveUsers(utils.generateUsers(1));
      const [target] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );

      const { nextCalled } = await runHandler((res, next) =>
        profileController.userMiniByID(
          { user: { _id: viewer._id, roles: ['user'] } },
          res,
          next,
          target._id.toString(),
        ),
      );
      nextCalled.should.be.true();
    });

    it('responds with 404 for a private profile', async () => {
      const [viewer] = await utils.saveUsers(utils.generateUsers(1));
      const [target] = await utils.saveUsers(utils.generateUsers(1));

      const { res } = await runHandler((res, next) =>
        profileController.userMiniByID(
          { user: { _id: viewer._id, roles: ['user'] } },
          res,
          next,
          target._id.toString(),
        ),
      );
      res.statusCode.should.equal(404);
    });

    it('responds with 404 when the viewer has blocked the profile owner', async () => {
      const [viewer, target] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const viewerDoc = await findUser(viewer._id);
      viewerDoc.blocked = [new mongoose.Types.ObjectId(target._id.toString())];
      await viewerDoc.save();

      const { res } = await runHandler((res, next) =>
        profileController.userMiniByID(
          {
            user: viewerDoc,
          },
          res,
          next,
          target._id.toString(),
        ),
      );
      res.statusCode.should.equal(404);
    });

    it('allows admins to load a suspended profile', async () => {
      const [admin, target] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const targetDoc = await findUser(target._id);
      targetDoc.roles = ['suspended'];
      await targetDoc.save();

      const { nextCalled } = await runHandler((res, next) =>
        profileController.userMiniByID(
          {
            user: { _id: admin._id, roles: ['admin'] },
          },
          res,
          next,
          target._id.toString(),
        ),
      );
      nextCalled.should.be.true();
    });
  });

  describe('userByUsername', () => {
    it('responds with 403 without a user', async () => {
      const { res } = await runHandler((res, next) =>
        profileController.userByUsername({}, res, next, 'someusername'),
      );
      res.statusCode.should.equal(403);
    });

    for (const username of ['ab', 42, '   ']) {
      it(`responds with 400 for the username ${JSON.stringify(username)}`, async () => {
        const { res } = await runHandler((res, next) =>
          profileController.userByUsername({ user: {} }, res, next, username),
        );
        res.statusCode.should.equal(400);
        responseBody(res).should.deepEqual({
          message: 'Valid username required.',
        });
      });
    }

    it('responds with 404 for a missing three-letter username', async () => {
      const [viewer] = await utils.saveUsers(utils.generateUsers(1));
      const { res } = await runHandler((res, next) =>
        profileController.userByUsername(
          { user: { _id: viewer._id, roles: ['user'] } },
          res,
          next,
          'abc',
        ),
      );
      res.statusCode.should.equal(404);
      responseBody(res).should.deepEqual({ message: 'Not found.' });
    });

    it('accepts a thenable profile lookup without populate or exec helpers', async () => {
      const [viewer] = await utils.saveUsers(utils.generateUsers(1));
      sinon
        .stub(User, 'findOne')
        .returns(
          Promise.resolve(null) as unknown as ReturnType<typeof User.findOne>,
        );
      const { res } = await runHandler((res, next) =>
        profileController.userByUsername(
          { user: { _id: viewer._id, roles: ['user'] } },
          res,
          next,
          'promiseusername',
        ),
      );
      res.statusCode.should.equal(404);
    });

    it('calls next for an existing public profile in any letter case', async () => {
      const [viewer] = await utils.saveUsers(utils.generateUsers(1));
      const [target] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      const targetDoc = await findUser(target._id);

      const { nextCalled } = await runHandler((res, next) =>
        profileController.userByUsername(
          { user: { _id: viewer._id, roles: ['user'] } },
          res,
          next,
          targetDoc.username!.toUpperCase(),
        ),
      );
      nextCalled.should.be.true();
    });

    it('responds with 404 when the profile owner has blocked the viewer', async () => {
      const [viewer, target] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const targetDoc = await findUser(target._id);
      targetDoc.blocked = [new mongoose.Types.ObjectId(viewer._id.toString())];
      await targetDoc.save();

      const { res } = await runHandler((res, next) =>
        profileController.userByUsername(
          {
            user: { _id: viewer._id, roles: ['user'], blocked: [] },
          },
          res,
          next,
          targetDoc.username,
        ),
      );
      res.statusCode.should.equal(404);
      responseBody(res).should.deepEqual({ message: 'Not found.' });
    });

    it('passes unexpected middleware errors to next', async () => {
      sinon
        .stub(User, 'findOne')
        .throws(new Error('unexpected profile middleware failure'));
      const controller = profileController;

      const { nextCalled, nextArg } = await runHandler((res, next) =>
        controller.userByUsername(
          { user: { roles: ['user'] } },
          res,
          next,
          'someusername',
        ),
      );

      nextCalled.should.be.true();
      errorMessage(nextArg).should.equal(
        'unexpected profile middleware failure',
      );
    });

    it('continues when reply statistics lookup fails', async () => {
      const controller = stubControllerDependencies(controllerPath, {
        './../../../messages/server/services/message-stat.server.service.mjs': {
          readFormattedMessageStatsOfUser(
            _userId: unknown,
            _now: Date,
            cb: (error: Error) => void,
          ) {
            cb(new Error('stats unavailable'));
          },
        },
      });
      const [viewer] = await utils.saveUsers(utils.generateUsers(1));
      const [target] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      const targetDoc = await findUser(target._id);

      const { nextCalled } = await runHandler((res, next) =>
        controller.userByUsername(
          { user: { _id: viewer._id, roles: ['user'] } },
          res,
          next,
          targetDoc.username,
        ),
      );

      nextCalled.should.be.true();
    });

    it('does not continue middleware after a missing profile response', async () => {
      const { res, nextCalled } = await runHandler((res, next) =>
        profileController.userByUsername(
          { user: { roles: ['user'] } },
          res,
          next,
          'missingmember',
        ),
      );
      res.statusCode.should.equal(404);
      nextCalled.should.be.false();
    });
  });

  describe('getUserMemberships', () => {
    it('responds with 403 without a user', async () => {
      const { res } = await runHandler(res =>
        profileController.getUserMemberships({}, res),
      );
      res.statusCode.should.equal(403);
    });

    it('returns tribe memberships for the authenticated user', async () => {
      const tribe = await new Tribe({ label: 'Membership Tribe' }).save();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.member = [{ tribe: tribe._id, since: new Date() }];
      await userDoc.save();

      const { res } = await runHandler(res =>
        profileController.getUserMemberships({ user: userDoc }, res),
      );
      res.statusCode.should.equal(200);
      responseArray(res).length.should.equal(1);
      responseMemberLabel(res).should.equal('Membership Tribe');
    });

    it('returns an empty membership list when the user has no memberships', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);

      const { res } = await runHandler(res =>
        profileController.getUserMemberships({ user: userDoc }, res),
      );

      res.statusCode.should.equal(200);
      Array.from(responseArray(res)).should.deepEqual([]);
    });

    it('returns an empty membership list when memberships are null', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const membershipQuery = {
        populate: () => ({
          exec: () => Promise.resolve({ member: null }),
        }),
      };
      sinon
        .stub(User, 'findById')
        .returns(
          membershipQuery as unknown as ReturnType<typeof User.findById>,
        );

      const { res } = await runHandler(res =>
        profileController.getUserMemberships({ user: { _id: saved._id } }, res),
      );

      res.statusCode.should.equal(200);
      responseBody(res).should.deepEqual([]);
    });

    it('returns 400 when loading memberships fails', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const failedMembershipQuery = {
        populate: () => ({
          exec: () => Promise.reject(new Error('membership lookup failed')),
        }),
      };
      sinon
        .stub(User, 'findById')
        .returns(
          failedMembershipQuery as unknown as ReturnType<typeof User.findById>,
        );

      const { res } = await runHandler(res =>
        profileController.getUserMemberships({ user: { _id: saved._id } }, res),
      );
      res.statusCode.should.equal(400);
      responseString(res, 'message').should.equal(
        'Failed to get list of tribes.',
      );
    });
  });

  describe('push registration', () => {
    it('removePushRegistration responds with 403 without a user', async () => {
      const { res } = await runHandler(res =>
        profileController.removePushRegistration(
          { params: { token: 'abc' } },
          res,
        ),
      );
      res.statusCode.should.equal(403);
    });

    it('removePushRegistration removes an existing registration', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.pushRegistration = ['device-token', 'other-token'].map(token => ({
        platform: 'android',
        token,
        created: new Date(),
      }));
      await userDoc.save();

      const { res } = await runHandler(res =>
        profileController.removePushRegistration(
          {
            user: userDoc,
            params: { token: 'device-token' },
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);
      responseString(res, 'message').should.equal('Removed registration.');

      const reloaded = await findUser(saved._id);
      reloaded
        .pushRegistration!.map(registration => registration.token)
        .should.deepEqual(['other-token']);
    });

    it('addPushRegistration rejects new registrations', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const { res } = await runHandler(res =>
        profileController.addPushRegistration(
          {
            user: { _id: saved._id },
            body: {
              token: 'new-device-token',
              platform: 'web',
            },
          },
          res,
        ),
      );
      res.statusCode.should.equal(400);
      responseString(res, 'message').should.equal(
        'Push notifications are no longer available.',
      );
    });
  });

  describe('joinTribe and leaveTribe', () => {
    for (const action of ['joinTribe', 'leaveTribe']) {
      it(`${action} responds with 403 without a user`, async () => {
        const { res } = await runHandler(res =>
          profileController[action]({ params: { tribeId: 'x' } }, res),
        );
        res.statusCode.should.equal(403);
      });

      it(`${action} rejects an invalid tribe id`, async () => {
        const [saved] = await utils.saveUsers(utils.generateUsers(1));
        const { res } = await runHandler(res =>
          profileController[action](
            {
              user: { _id: saved._id, member: [] },
              params: { tribeId: 'bad' },
            },
            res,
          ),
        );
        res.statusCode.should.equal(400);
      });
    }

    it('joinTribe rejects joining the same tribe twice', async () => {
      const tribe = await new Tribe({ label: 'Unit Tribe' }).save();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.member = [{ tribe: tribe._id, since: new Date() }];
      await userDoc.save();

      const { res } = await runHandler(res =>
        profileController.joinTribe(
          {
            user: userDoc,
            params: { tribeId: tribe._id.toString() },
          },
          res,
        ),
      );
      res.statusCode.should.equal(409);
    });

    it('leaveTribe rejects leaving a tribe that no longer exists', async () => {
      const tribe = await new Tribe({ label: 'Deleted Tribe' }).save();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.member = [{ tribe: tribe._id, since: new Date() }];
      await userDoc.save();
      await Tribe.findByIdAndDelete(tribe._id);

      const { res } = await runHandler(res =>
        profileController.leaveTribe(
          {
            user: userDoc,
            params: { tribeId: tribe._id.toString() },
          },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('leaveTribe rejects leaving a tribe you do not belong to', async () => {
      const tribe = await new Tribe({ label: 'Leave Tribe' }).save();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const { res } = await runHandler(res =>
        profileController.leaveTribe(
          {
            user: { _id: saved._id, member: [] },
            params: { tribeId: tribe._id.toString() },
          },
          res,
        ),
      );
      res.statusCode.should.equal(409);
    });

    it('reports joins and leaves to stats and only pulls the left tribe', async () => {
      const [kept, changed] = await Tribe.create([
        { label: 'Kept Tribe' },
        { label: 'Changed Tribe' },
      ]);
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      await User.updateOne(
        { _id: saved._id },
        { member: [{ tribe: kept._id, since: new Date() }] },
      );
      const stats = recordStats();
      for (const action of ['joinTribe', 'leaveTribe']) {
        const user = await findUser(saved._id);
        const { res } = await runHandler(res =>
          profileController[action](
            { user, params: { tribeId: changed._id.toString() } },
            res,
          ),
        );
        res.statusCode.should.equal(200);
      }
      stats.should.deepEqual(
        [1, -1].map(count => ({
          namespace: 'tagAction',
          counts: { count },
          tags: { type: 'tribe' },
          meta: { slug: changed.slug },
        })),
      );
      (await findUser(saved._id))
        .member!.map(membership => String(membership.tribe))
        .should.deepEqual([String(kept._id)]);
    });

    it('joinTribe rejects a tribe that does not exist', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const { res } = await runHandler(res =>
        profileController.joinTribe(
          {
            // A legacy account without a membership list is not a member.
            user: { _id: saved._id },
            params: { tribeId: new mongoose.Types.ObjectId().toString() },
          },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('joinTribe adds the user to a tribe', async () => {
      const tribe = await new Tribe({ label: 'Join Tribe' }).save();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.member = [];
      await userDoc.save();

      const { res } = await runHandler(res =>
        profileController.joinTribe(
          {
            user: userDoc,
            params: { tribeId: tribe._id.toString() },
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);
      responseString(res, 'message').should.equal('Joined tribe.');

      const reloaded = await findUser(saved._id);
      reloaded.member!.length.should.equal(1);
    });

    it('leaveTribe removes the user from a tribe', async () => {
      const tribe = await new Tribe({ label: 'Leave Success Tribe' }).save();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.member = [{ tribe: tribe._id, since: new Date() }];
      await userDoc.save();

      const { res } = await runHandler(res =>
        profileController.leaveTribe(
          {
            user: userDoc,
            params: { tribeId: tribe._id.toString() },
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);
      responseString(res, 'message').should.equal('Left tribe.');

      const reloaded = await findUser(saved._id);
      reloaded.member!.length.should.equal(0);
    });

    it('joinTribe returns 400 when saving the membership fails', async () => {
      const tribe = await new Tribe({ label: 'Join Error Tribe' }).save();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.member = [];
      await userDoc.save();

      const failedMembershipUpdate = {
        exec: () => Promise.reject(new Error('save failed')),
      };
      sinon
        .stub(User, 'findByIdAndUpdate')
        .returns(
          failedMembershipUpdate as unknown as ReturnType<
            typeof User.findByIdAndUpdate
          >,
        );

      const { res } = await runHandler(res =>
        profileController.joinTribe(
          {
            user: userDoc,
            params: { tribeId: tribe._id.toString() },
          },
          res,
        ),
      );
      res.statusCode.should.equal(400);
      responseString(res, 'message').should.equal('Failed to join tribe.');
    });

    it('leaveTribe returns 400 when saving the membership fails', async () => {
      const tribe = await new Tribe({ label: 'Leave Error Tribe' }).save();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.member = [{ tribe: tribe._id, since: new Date() }];
      await userDoc.save();

      const failedMembershipUpdate = {
        exec: () => Promise.reject(new Error('save failed')),
      };
      sinon
        .stub(User, 'findByIdAndUpdate')
        .returns(
          failedMembershipUpdate as unknown as ReturnType<
            typeof User.findByIdAndUpdate
          >,
        );

      const { res } = await runHandler(res =>
        profileController.leaveTribe(
          {
            user: userDoc,
            params: { tribeId: tribe._id.toString() },
          },
          res,
        ),
      );
      res.statusCode.should.equal(400);
      responseString(res, 'message').should.equal('Failed to leave tribe.');
    });
  });

  describe('sanitizeProfile', () => {
    it('returns undefined for a missing profile', () => {
      (profileController.sanitizeProfile(null) === undefined).should.be.true();
    });

    const bareProfile = (extra: Record<string, unknown> = {}) => {
      const _id = new mongoose.Types.ObjectId();
      return {
        _id,
        toObject: () => ({
          _id,
          email: 'bare@example.test',
          roles: [],
          ...extra,
        }),
      };
    };

    for (const [label, viewer] of [
      ['no viewer', undefined],
      ['a viewer with another string id', { _id: 'another-member' }],
    ] as const) {
      it(`treats a profile seen by ${label} as public`, () => {
        const sanitized = profileController.sanitizeProfile(
          bareProfile(),
          viewer,
        );
        should.not.exist(sanitized.email);
        should.not.exist(sanitized.usernameUpdateAllowed);
      });
    }

    it('adds no description, memberships or providers the profile lacks', () => {
      const sanitized = profileController.sanitizeOwnProfile(bareProfile());
      for (const field of ['description', 'member', 'additionalProvidersData'])
        (sanitized[field] === undefined).should.be.true();
      sanitized.memberIds.should.deepEqual([]);
    });

    it('keeps only the known providers a profile has', () => {
      const sanitized = profileController.sanitizeOwnProfile(
        bareProfile({
          additionalProvidersData: {
            facebook: null,
            github: { login: 'fictional-github-login' },
          },
        }),
      );
      Object.keys(sanitized.additionalProvidersData).should.deepEqual([
        'facebook',
        'github',
      ]);
    });

    it('omits private and unrecognised document fields after sanitisation', () => {
      const profile = {
        toObject: () => ({
          _id: new mongoose.Types.ObjectId(),
          created: new Date('2020-01-01T00:00:00.000Z'),
          displayName: 'Fictional Member',
          usernameHistory: [
            {
              oldUsername: 'formername',
              newUsername: 'fictional',
              changedAt: new Date('2025-01-01T00:00:00.000Z'),
            },
          ],
          email: 'member@example.test',
          locale: 'en',
          blocked: [],
          description: '',
          member: [],
          roles: ['user'],
          lastIpHash: '192.0.2.1',
          pushRegistration: [{ token: 'fictional-push-token' }],
          providerData: [{ accessToken: 'fictional-provider-token' }],
          futurePrivateField: 'must stay private',
        }),
      };

      const sanitized = profileController.sanitizeOwnProfile(profile);

      sanitized.displayName.should.equal('Fictional Member');
      sanitized.email.should.equal('member@example.test');
      sanitized.locale.should.equal('en');
      for (const field of [
        'lastIpHash',
        'pushRegistration',
        'providerData',
        'usernameHistory',
        'futurePrivateField',
      ]) {
        (sanitized[field] === undefined).should.be.true();
      }

      const publicSanitized = profileController.sanitizeProfile(
        profile,
        false,
        null,
      );
      (publicSanitized?.usernameHistory === undefined).should.be.true();
    });

    it('derives public greeter recognition from current roles without exposing roles', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.roles = ['user', 'volunteer', 'welcome-team'];
      const first = profileController.sanitizeProfile(userDoc, userDoc);
      first.isGreeter.should.be.true();
      first.isVolunteer.should.be.true();
      (first.roles === undefined).should.be.true();
      userDoc.roles = ['user'];
      const second = profileController.sanitizeProfile(userDoc, userDoc);
      second.isGreeter.should.be.false();
    });

    for (const [role, flag] of [
      ['volunteer', 'isVolunteer'],
      ['volunteer-alumni', 'isVolunteerAlumni'],
    ]) {
      it(`marks the ${role} role on the sanitized profile`, async () => {
        const [saved] = await utils.saveUsers(utils.generateUsers(1));
        const userDoc = await findUser(saved._id);
        userDoc.roles = ['user', role];
        const sanitized = profileController.sanitizeProfile(userDoc, userDoc);
        sanitized[flag].should.be.true();
        (sanitized.roles === undefined).should.be.true();
      });
    }

    it('retains only the minimal public identity for legacy providers', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.additionalProvidersData = {
        facebook: {
          id: 'fictional-facebook-id',
          accessToken: 'fictional-access-token',
          refreshToken: 'fictional-refresh-token',
          accessTokenExpires: new Date(),
          email: 'legacy-facebook@example.test',
          _json: { name: 'Fictional Facebook Member' },
        },
        github: {
          login: 'fictional-github-login',
          accessToken: 'fictional-github-token',
          id: 123,
          email: 'legacy-github@example.test',
        },
        twitter: {
          screen_name: 'fictional-twitter-member',
          token: 'fictional-twitter-token',
          tokenSecret: 'fictional-twitter-secret',
          _json: { name: 'Fictional Twitter Member' },
        },
        unknown: { id: 'unknown-id', accessToken: 'unknown-token' },
      };

      const sanitized = profileController.sanitizeProfile(userDoc, userDoc);

      sanitized.additionalProvidersData.should.deepEqual({
        facebook: { id: 'fictional-facebook-id' },
        github: { login: 'fictional-github-login' },
        twitter: { screen_name: 'fictional-twitter-member' },
      });
    });

    it('hides external contact details from shadowbanned viewers', async () => {
      const [savedProfile, savedViewer] = await utils.saveUsers(
        utils.generateUsers(2),
      );
      const profile = await findUser(savedProfile._id);
      const viewer = await findUser(savedViewer._id);
      profile.description =
        '<p>Contact member@example.org, (555) 666-7777 or https://example.org/profile.</p>';
      profile.extSitesBW = 'fictional-member';
      profile.extSitesCS = 'fictional-member';
      profile.extSitesCouchers = 'fictional-member';
      profile.extSitesWS = 'fictional-member';
      profile.extSitesServas = 'household/fictional-host';
      profile.nostrNpub =
        'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq0l7z9';
      profile.additionalProvidersData = {
        facebook: { id: 'fictional-facebook-id' },
        github: { login: 'fictional-github-login' },
        twitter: { screen_name: 'fictional-twitter-member' },
      };
      viewer.roles = ['user', 'shadowban'];

      const sanitized = profileController.sanitizeProfile(profile, viewer);

      sanitized.description.should.equal('Contact ,  or .');
      (sanitized.additionalProvidersData === undefined).should.be.true();
      (sanitized.extSitesBW === undefined).should.be.true();
      (sanitized.extSitesCS === undefined).should.be.true();
      (sanitized.extSitesCouchers === undefined).should.be.true();
      (sanitized.extSitesWS === undefined).should.be.true();
      (sanitized.extSitesServas === undefined).should.be.true();
      (sanitized.nostrNpub === undefined).should.be.true();
    });

    it('keeps external contact details on a shadowbanned member own profile', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const profile = await findUser(saved._id);
      profile.roles = ['user', 'shadowban'];
      profile.description = '<p>Visit https://example.org/profile.</p>';
      profile.extSitesBW = 'fictional-member';

      const sanitized = profileController.sanitizeProfile(profile, profile);

      sanitized.description.should.containEql('https://example.org/profile');
      sanitized.extSitesBW.should.equal('fictional-member');
    });

    it('keeps external contact details for administrative viewers', async () => {
      const [savedProfile, savedViewer] = await utils.saveUsers(
        utils.generateUsers(2),
      );
      const profile = await findUser(savedProfile._id);
      const viewer = await findUser(savedViewer._id);
      profile.description = '<p>Visit https://example.org/profile.</p>';
      profile.extSitesBW = 'fictional-member';
      viewer.roles = ['user', 'admin', 'shadowban'];

      const sanitized = profileController.sanitizeProfile(profile, viewer);

      sanitized.description.should.containEql('https://example.org/profile');
      sanitized.extSitesBW.should.equal('fictional-member');
    });

    it('collects member tribe ids from unpopulated memberships', async () => {
      const tribe = await new Tribe({ label: 'ObjectId Tribe' }).save();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.member = [{ tribe: tribe._id, since: new Date() }];
      await userDoc.save();
      const plain = await findUser(saved._id);

      const sanitized = profileController.sanitizeProfile(plain, plain);
      sanitized.memberIds.should.containEql(tribe._id.toString());
    });

    it('collects member tribe ids from populated memberships', async () => {
      const tribe = await new Tribe({ label: 'Sanitize Tribe' }).save();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.member = [{ tribe: tribe._id, since: new Date() }];
      await userDoc.save();
      const memberQuery = User.findById(saved._id);
      if (!memberQuery) throw new Error('Expected user lookup query');
      const populated = await memberQuery.populate('member.tribe');
      if (!populated) throw new Error('Expected populated user');

      const sanitized = profileController.sanitizeProfile(populated, populated);
      sanitized.memberIds.should.containEql(tribe._id.toString());
    });

    it('collects member tribe ids from plain unpopulated membership ids', () => {
      const profileId = new mongoose.Types.ObjectId();
      const tribeId = 'plain-tribe-id';
      const profile = {
        toObject: () => ({
          _id: profileId,
          created: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
          member: [{ tribe: tribeId }, {}],
          roles: [],
        }),
      };

      const sanitized = profileController.sanitizeProfile(profile, {
        _id: profileId,
      });

      sanitized.memberIds.should.deepEqual([tribeId]);
    });

    it('skips memberships with missing tribe references', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.member = [
        { tribe: new mongoose.Types.ObjectId(), since: new Date() },
      ];
      await userDoc.save();
      const memberQuery = User.findById(saved._id);
      if (!memberQuery) throw new Error('Expected user lookup query');
      const profile = await memberQuery.populate('member.tribe');
      if (!profile) throw new Error('Expected populated user');

      const sanitized = profileController.sanitizeProfile(profile, profile);

      sanitized.memberIds.should.deepEqual([]);
      sanitized.member.should.deepEqual([]);
    });

    it('treats matching string ids as the authenticated user', () => {
      const userId = new mongoose.Types.ObjectId();
      const profile = {
        _id: userId,
        toObject() {
          return {
            _id: userId,
            created: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
            member: [],
            roles: [],
          };
        },
      };

      const sanitized = profileController.sanitizeProfile(profile, {
        _id: userId.toString(),
      });

      sanitized.usernameUpdateAllowed.should.be.true();
    });
  });

  describe('search middleware', () => {
    it('calls next when no search query is provided', async () => {
      let nextCalled = false;
      await new Promise<void>(resolve => {
        profileController.search({ query: {} }, {}, () => {
          nextCalled = true;
          resolve();
        });
      });
      nextCalled.should.be.true();
    });

    it('rejects a search string that is too short', async () => {
      const { res } = await runHandler((res, next) =>
        profileController.search(
          { query: { search: 'ab' }, user: { blocked: [] } },
          res,
          next,
        ),
      );
      res.statusCode.should.equal(400);
    });

    const searchOutcome = (search: string, skip: number) =>
      runHandler((res, next) =>
        profileController.search(
          {
            query: { search },
            user: { _id: new mongoose.Types.ObjectId(), blocked: [] },
            skip,
          },
          res,
          next,
        ),
      );

    for (const [label, search, skip] of [
      ['a 120-character search', 'x'.repeat(120), 0],
      ['the last allowed page', 'Findme', 1000],
    ] as const) {
      it(`accepts ${label}`, async () => {
        stubSearch(() => {}, []);
        const { res } = await searchOutcome(search, skip);
        res.statusCode.should.equal(200);
      });
    }

    it('rejects pages beyond the search window', async () => {
      const { res } = await searchOutcome('Findme', 1001);
      res.statusCode.should.equal(400);
      responseBody(res).should.deepEqual({
        message:
          'Please refine your member search instead of requesting more pages.',
      });
    });

    it('searches for the trimmed text', async () => {
      stubSearch(
        filter =>
          assertFilterContains(filter, { $text: { $search: 'Findme' } }),
        [],
      );
      const { res } = await searchOutcome('  Findme  ', 0);
      res.statusCode.should.equal(200);
    });

    it('returns matching public profiles', async () => {
      const [viewer, target] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const targetDoc = await findUser(target._id);
      targetDoc.tagline = 'UniqueSearchableTagline';
      await targetDoc.save();

      const { res } = await runHandler((res, next) =>
        profileController.search(
          {
            query: { search: 'UniqueSearchable' },
            user: { _id: viewer._id, blocked: [] },
            skip: 0,
          },
          res,
          next,
        ),
      );
      res.statusCode.should.equal(200);
      responseArray(res).should.be.an.Array();
    });

    it('filters out users blocked by the viewer', async () => {
      const [viewer, blockedTarget] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const visibleDoc = await findUser(viewer._id);

      stubSearch(
        query =>
          assertFilterContains(query, { _id: { $nin: [blockedTarget._id] } }),
        [visibleDoc],
      );

      const { res } = await runHandler((res, next) =>
        profileController.search(
          {
            query: { search: 'Findme' },
            user: {
              _id: viewer._id,
              blocked: [
                new mongoose.Types.ObjectId(blockedTarget._id.toString()),
              ],
            },
            skip: 0,
          },
          res,
          next,
        ),
      );
      res.statusCode.should.equal(200);
      responseArray(res).length.should.equal(1);
    });

    it('excludes suspended and shadowbanned users from the query', async () => {
      const [viewer] = await utils.saveUsers(utils.generateUsers(1));
      const visibleDoc = await findUser(viewer._id);
      stubSearch(
        query =>
          assertFilterContains(query, {
            roles: { $nin: ['suspended', 'shadowban'] },
          }),
        [visibleDoc],
      );

      const { res } = await runHandler((res, next) =>
        profileController.search(
          {
            query: { search: 'Findme' },
            user: { _id: viewer._id, blocked: [] },
            skip: 0,
          },
          res,
          next,
        ),
      );

      res.statusCode.should.equal(200);
    });

    it('defaults blocked users to an empty list when searching', async () => {
      const [viewer] = await utils.saveUsers(utils.generateUsers(1));
      const visibleDoc = await findUser(viewer._id);
      stubSearch(
        query => assertFilterContains(query, { _id: { $nin: [] } }),
        [visibleDoc],
      );

      const { res } = await runHandler((res, next) =>
        profileController.search(
          {
            query: { search: 'Findme' },
            user: { _id: viewer._id, id: viewer._id },
            skip: 0,
          },
          res,
          next,
        ),
      );

      res.statusCode.should.equal(200);
      responseArray(res).length.should.equal(1);
    });

    it('passes search lookup errors to next', async () => {
      stubSearch(() => {}, [], new Error('search failed'));

      const { nextCalled, nextArg } = await runHandler((res, next) =>
        profileController.search(
          {
            query: { search: 'Findme' },
            user: { _id: new mongoose.Types.ObjectId(), blocked: [] },
            skip: 0,
          },
          res,
          next,
        ),
      );

      nextCalled.should.be.true();
      errorMessage(nextArg).should.equal('search failed');
    });

    it('filters out users who have blocked the viewer', async () => {
      const [viewer, blocker] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const blockerDoc = await findUser(blocker._id);
      blockerDoc.firstName = 'BlockerSearchPerson';
      blockerDoc.blocked = [new mongoose.Types.ObjectId(viewer._id.toString())];
      await blockerDoc.save();

      const { res } = await runHandler((res, next) =>
        profileController.search(
          {
            query: { search: 'BlockerSearch' },
            user: { _id: viewer._id, id: viewer._id, blocked: [] },
            skip: 0,
          },
          res,
          next,
        ),
      );
      res.statusCode.should.equal(200);
      responseArray(res).length.should.equal(0);
    });
  });
});
