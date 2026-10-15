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

const validNpub =
  'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzqujme';

interface MockResponse {
  statusCode: number;
  body: unknown;
  _next: boolean;
  _nextArg: unknown;
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
          callback: (
            error: Error | null,
            result: ProfileUserDocument[] | null,
          ) => void,
        ) => callback(error, error ? null : users),
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
const emailServicePath =
  './../../../core/server/services/email.server.service.mjs';

function getEmailService(): {
  sendChangeEmailConfirmation(
    user: unknown,
    callback: (error?: Error | null) => void,
  ): void;
  sendEmailChangeNotificationToOldAddress(
    user: unknown,
    previousEmail: string,
    callback: (error?: Error | null) => void,
  ): void;
} {
  return require(emailServicePath);
}

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

describe('Profile controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
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

    it('rejects an invalid nostrNpub', async () => {
      const { res } = await runHandler(res =>
        profileController.update(
          { user: userDoc, body: { nostrNpub: 'npub-not-valid' } },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

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
      const failedNpubLookup = (
        _query: unknown,
        _fields: unknown,
        callback: (error: Error | null, user: unknown) => void,
      ): void => callback(new Error('lookup failed'), null);
      sinon
        .stub(User, 'findOne')
        .callsFake(failedNpubLookup as unknown as typeof User.findOne);

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

    it('rejects an email already used by someone else', async () => {
      const [other] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      await findUser(other._id);

      const { res } = await runHandler(res =>
        profileController.update(
          {
            user: userDoc,
            body: { email: 'new-address@example.test' },
            login: () => {},
          },
          res,
        ),
      );
      res.statusCode.should.equal(400);
      responseString(res, 'message').should.containEql('current password');
    });

    it('lets an unconfirmed user resend confirmation for their pending email', async () => {
      userDoc.public = false;
      userDoc.emailTemporary = 'pending-address@example.test';
      await userDoc.save();
      const sendConfirmation = sinon
        .stub(getEmailService(), 'sendChangeEmailConfirmation')
        .callsFake((user, callback) => callback());

      const { res } = await runHandler(res =>
        profileController.update(
          {
            user: userDoc,
            body: { email: 'pending-address@example.test' },
            login: (_user: unknown, callback: () => void) => callback(),
          },
          res,
        ),
      );

      res.statusCode.should.equal(200);
      sendConfirmation.calledOnce.should.equal(true);
      responseString(res, 'emailTemporary').should.equal(
        'pending-address@example.test',
      );
    });

    it('blocks an unconfirmed email already used by another account', async () => {
      userDoc.public = false;
      await userDoc.save();
      const [other] = await utils.saveUsers(utils.generateUsers(1));
      other.emailTemporary = 'claimed-address@example.test';
      await other.save();

      const { res } = await runHandler(res =>
        profileController.update(
          {
            user: userDoc,
            body: { email: 'CLAIMED-ADDRESS@example.test' },
            login: (_user: unknown, callback: () => void) => callback(),
          },
          res,
        ),
      );

      res.statusCode.should.equal(403);
      responseString(res, 'message').should.containEql('already in use');
    });

    it('saves an available confirmation address for an unconfirmed user', async () => {
      userDoc.public = false;
      await userDoc.save();
      const sendConfirmation = sinon
        .stub(getEmailService(), 'sendChangeEmailConfirmation')
        .callsFake((user, callback) => callback());

      const { res } = await runHandler(res =>
        profileController.update(
          {
            user: userDoc,
            body: { email: 'available-address@example.test' },
            login: (_user: unknown, callback: () => void) => callback(),
          },
          res,
        ),
      );

      res.statusCode.should.equal(200);
      sendConfirmation.calledOnce.should.equal(true);
      const reloaded = await findUser(userDoc._id);
      reloaded.emailTemporary!.should.equal('available-address@example.test');
      reloaded.emailToken!.should.match(/^sha256:[a-f0-9]{64}$/);
      reloaded.emailTokenIssuedAt!.should.be.a.Date();
      reloaded.emailTokenExpires!.should.be.a.Date();
    });

    it('updates a simple field', async () => {
      const { res } = await runHandler(res =>
        profileController.update(
          {
            user: userDoc,
            body: { tagline: 'New tagline' },
            login: (_user: unknown, cb: () => void) => cb(),
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);
      responseString(res, 'tagline').should.equal('New tagline');
    });

    it('allows resubmitting the same email address', async () => {
      const { res } = await runHandler(res =>
        profileController.update(
          {
            user: userDoc,
            body: { email: userDoc.email },
            login: (_user: unknown, cb: () => void) => cb(),
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);
    });

    it('does not allow changing email through the general profile update handler', async () => {
      userDoc.public = true;
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
      res.statusCode.should.equal(400);
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
      userDoc.lastIpAddress = '192.0.2.10';
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
              lastIpAddress: '198.51.100.20',
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
      saved.lastIpAddress!.should.equal('192.0.2.10');
      saved.providerData!.should.deepEqual({ id: 'sample-provider' });
      saved.roles!.should.not.containEql('admin');
    });

    it('returns 400 when saving profile updates fails', async () => {
      const failedSave = (callback: (error: Error | null) => void): void =>
        callback(new Error('save failed'));
      sinon
        .stub(userDoc, 'save')
        .callsFake(failedSave as unknown as typeof userDoc.save);

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

    it('ignores a successful final waterfall callback', () => {
      const controller = stubControllerDependencies(controllerPath, {
        async: {
          waterfall(_steps: unknown[], done: (error?: Error | null) => void) {
            done();
          },
        },
      });
      const res = {
        status: sinon.stub().returnsThis(),
        send: sinon.stub(),
        json: sinon.stub(),
      };

      controller.update(
        {
          user: userDoc,
          body: { tagline: 'No response from final callback' },
          login: (_user: unknown, cb: () => void) => cb(),
        },
        res,
      );

      res.status.called.should.be.false();
      res.send.called.should.be.false();
      res.json.called.should.be.false();
    });

    it('stages an email change after password confirmation and queues both messages', async () => {
      userDoc.public = true;
      userDoc.password = 'Password123!';
      await userDoc.save();
      sinon
        .stub(getEmailService(), 'sendChangeEmailConfirmation')
        .callsFake((user, callback) => callback());
      sinon
        .stub(getEmailService(), 'sendEmailChangeNotificationToOldAddress')
        .callsFake((user, previousEmail, callback) => callback());

      const { res } = await runHandler(res =>
        profileController.changeEmail(
          {
            user: userDoc,
            body: {
              email: 'brand-new-email@example.com',
              currentPassword: 'Password123!',
            },
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

    it('responds with 403 for suspended users', async () => {
      const { res } = await runHandler(res =>
        profileController.initializeRemoveProfile(
          {
            user: { _id: new mongoose.Types.ObjectId(), roles: ['suspended'] },
          },
          res,
        ),
      );
      res.statusCode.should.equal(403);
    });

    it('responds with 403 for shadowbanned users', async () => {
      const { res } = await runHandler(res =>
        profileController.initializeRemoveProfile(
          {
            user: { _id: new mongoose.Types.ObjectId(), roles: ['shadowban'] },
          },
          res,
        ),
      );
      res.statusCode.should.equal(403);
    });

    it('sends a removal confirmation email for a valid user', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);

      const { res } = await runHandler(res =>
        profileController.initializeRemoveProfile({ user: userDoc }, res),
      );

      res.statusCode.should.equal(200);
      responseString(res, 'message').should.containEql('email');

      const reloaded = await findUser(saved._id);
      should.exist(reloaded.removeProfileToken);
      should.exist(reloaded.removeProfileExpires);
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
    });

    it('returns 400 without sending a removal email when token persistence fails', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      const failedTokenPersistence = (
        _query: unknown,
        _update: unknown,
        _options: unknown,
        callback: (error: Error | null, user: unknown) => void,
      ): void => callback(new Error('storage unavailable'), null);
      sinon
        .stub(User, 'findOneAndUpdate')
        .callsFake(
          failedTokenPersistence as unknown as typeof User.findOneAndUpdate,
        );
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

    it('ignores a successful final removal initialization callback', () => {
      const controller = stubControllerDependencies(controllerPath, {
        async: {
          waterfall(_steps: unknown[], done: (error?: Error | null) => void) {
            done();
          },
        },
      });
      const res = {
        status: sinon.stub().returnsThis(),
        send: sinon.stub(),
      };

      controller.initializeRemoveProfile({ user: { roles: [] } }, res);

      res.status.called.should.be.false();
      res.send.called.should.be.false();
    });
  });

  describe('removeProfile', () => {
    it('responds with 403 without a user', async () => {
      const { res } = await runHandler(res =>
        profileController.removeProfile({}, res),
      );
      res.statusCode.should.equal(403);
    });

    it('responds with 400 for an invalid token', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const { res } = await runHandler(res =>
        profileController.removeProfile(
          { user: { _id: saved._id }, params: { token: 'invalid-token' } },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('removes the profile when the token is valid', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.removeProfileToken = 'valid-remove-token';
      userDoc.removeProfileExpires = new Date(Date.now() + 3600000);
      await userDoc.save();
      await UnifiedPushRegistration.create({
        user: saved._id,
        endpoint: 'https://ntfy.sh/anonymous-deleted-account',
        publicKey:
          'BNPRQG83KHuc4ZkSKlmSKQWC3PQm2YD-yOiPdjFbQyB8VM6ZZSLD2caRpXad6G_2qXqb_WUz7V2T7w1KqAXbslQ',
        auth: 'abcdefghijklmnopqrstuv',
      });

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

    it('still removes the profile when ancillary cleanup steps fail', async () => {
      const offerHandlerPath =
        './../../../offers/server/controllers/offers.server.controller.mjs';
      const contactHandlerPath =
        './../../../contacts/server/controllers/contacts.server.controller.mjs';
      const controller = stubControllerDependencies(controllerPath, {
        [emailServicePath]: {
          sendRemoveProfileConfirmed: (
            _user: unknown,
            cb: (error: Error) => void,
          ) => cb(new Error('confirm email failed')),
        },
        [offerHandlerPath]: {
          removeAllByUserId: (_userId: unknown, cb: (error: Error) => void) =>
            cb(new Error('offers failed')),
        },
        [contactHandlerPath]: {
          removeAllByUserId: (_userId: unknown, cb: (error: Error) => void) =>
            cb(new Error('contacts failed')),
        },
      });

      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.removeProfileToken = 'valid-remove-token';
      userDoc.removeProfileExpires = new Date(Date.now() + 3600000);
      await userDoc.save();

      const failedPushCleanup = (
        _query: unknown,
        callback: (error: Error | null) => void,
      ): void => callback(new Error('push cleanup failed'));
      const pushCleanup = sinon
        .stub(UnifiedPushRegistration, 'deleteMany')
        .callsFake(
          failedPushCleanup as unknown as typeof UnifiedPushRegistration.deleteMany,
        );
      const { res } = await runHandler(res =>
        controller.removeProfile(
          {
            user: { _id: saved._id },
            params: { token: 'valid-remove-token' },
          },
          res,
        ),
      );
      pushCleanup.restore();

      res.statusCode.should.equal(200);
      const gone = await User.findById(saved._id);
      should.not.exist(gone);
    });

    it('ignores a successful final removal callback', () => {
      const controller = stubControllerDependencies(controllerPath, {
        async: {
          waterfall(_steps: unknown[], done: (error?: Error | null) => void) {
            done();
          },
        },
      });
      const res = {
        status: sinon.stub().returnsThis(),
        send: sinon.stub(),
        json: sinon.stub(),
      };

      controller.removeProfile(
        {
          user: { _id: new mongoose.Types.ObjectId() },
          params: { token: 'valid-token' },
        },
        res,
      );

      res.status.called.should.be.false();
      res.send.called.should.be.false();
      res.json.called.should.be.false();
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

    it('responds with 400 for too short a username', async () => {
      const { res } = await runHandler((res, next) =>
        profileController.userByUsername({ user: {} }, res, next, 'ab'),
      );
      res.statusCode.should.equal(400);
    });

    it('responds with 404 for a missing username', async () => {
      const [viewer] = await utils.saveUsers(utils.generateUsers(1));
      const { res } = await runHandler((res, next) =>
        profileController.userByUsername(
          { user: { _id: viewer._id, roles: ['user'] } },
          res,
          next,
          'nosuchusername',
        ),
      );
      res.statusCode.should.equal(404);
    });

    it('calls next for an existing public profile', async () => {
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
          targetDoc.username,
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
    });

    it('passes unexpected middleware errors to next', async () => {
      const controller = stubControllerDependencies(controllerPath, {
        async: {
          waterfall(_steps: unknown[], done: (error?: Error | null) => void) {
            done(new Error('unexpected profile middleware failure'));
          },
        },
      });

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

    it('ignores a successful final username middleware callback', () => {
      const controller = stubControllerDependencies(controllerPath, {
        async: {
          waterfall(_steps: unknown[], done: (error?: Error | null) => void) {
            done();
          },
        },
      });
      const next = sinon.stub();

      controller.userByUsername(
        { user: { roles: ['user'] } },
        {},
        next,
        'someusername',
      );

      next.called.should.be.false();
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
          exec: (
            callback: (error: Error | null, value: { member: null }) => void,
          ) => callback(null, { member: null }),
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
          exec: (callback: (error: Error | null, value: unknown) => void) =>
            callback(new Error('membership lookup failed'), null),
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
      userDoc.pushRegistration = [
        { platform: 'android', token: 'device-token', created: new Date() },
      ];
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
      reloaded.pushRegistration!.length.should.equal(0);
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
    it('joinTribe responds with 403 without a user', async () => {
      const { res } = await runHandler(res =>
        profileController.joinTribe({ params: { tribeId: 'x' } }, res),
      );
      res.statusCode.should.equal(403);
    });

    it('joinTribe rejects an invalid tribe id', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const { res } = await runHandler(res =>
        profileController.joinTribe(
          { user: { _id: saved._id, member: [] }, params: { tribeId: 'bad' } },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

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

    it('leaveTribe rejects an invalid tribe id', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const { res } = await runHandler(res =>
        profileController.leaveTribe(
          {
            user: { _id: saved._id, member: [] },
            params: { tribeId: 'not-an-object-id' },
          },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('leaveTribe rejects leaving a tribe that no longer exists', async () => {
      const tribe = await new Tribe({ label: 'Deleted Tribe' }).save();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.member = [{ tribe: tribe._id, since: new Date() }];
      await userDoc.save();
      await Tribe.findByIdAndRemove(tribe._id);

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

    it('leaveTribe responds with 403 without a user', async () => {
      const tribe = await new Tribe({ label: 'No User Tribe' }).save();
      const { res } = await runHandler(res =>
        profileController.leaveTribe(
          { params: { tribeId: tribe._id.toString() } },
          res,
        ),
      );
      res.statusCode.should.equal(403);
    });

    it('joinTribe rejects a tribe that does not exist', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const { res } = await runHandler(res =>
        profileController.joinTribe(
          {
            user: { _id: saved._id, member: [] },
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
        exec: (callback: (error: Error | null, value: unknown) => void) =>
          callback(new Error('save failed'), null),
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
        exec: (callback: (error: Error | null, value: unknown) => void) =>
          callback(new Error('save failed'), null),
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

    it('omits private and unrecognised document fields after sanitisation', () => {
      const profile = {
        toObject: () => ({
          _id: new mongoose.Types.ObjectId(),
          created: new Date('2020-01-01T00:00:00.000Z'),
          displayName: 'Fictional Member',
          email: 'member@example.test',
          locale: 'en',
          blocked: [],
          description: '',
          member: [],
          roles: ['user'],
          lastIpAddress: '192.0.2.1',
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
        'lastIpAddress',
        'pushRegistration',
        'providerData',
        'futurePrivateField',
      ]) {
        (sanitized[field] === undefined).should.be.true();
      }
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

    it('marks active volunteers on the sanitized profile', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.roles = ['user', 'volunteer'];
      await userDoc.save();

      const sanitized = profileController.sanitizeProfile(userDoc, userDoc);
      sanitized.isVolunteer.should.be.true();
    });

    it('marks volunteer alumni on the sanitized profile', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.roles = ['user', 'volunteer-alumni'];
      await userDoc.save();

      const sanitized = profileController.sanitizeProfile(userDoc, userDoc);
      sanitized.isVolunteerAlumni.should.be.true();
      (sanitized.roles === undefined).should.be.true();
    });

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
