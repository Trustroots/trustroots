/** Unit tests for the OAuth helpers of the authentication controller. */
const crypto: typeof import('crypto') = require('crypto');
const mongoose: typeof import('mongoose') = require('mongoose');
const mockModule: typeof import('../../../../testutils/server/mock-module.mts').default = require('../../../../testutils/server/mock-module');
const sinon: typeof import('sinon') = require('sinon');
const winston: typeof import('winston') = require('winston');
const should: typeof import('should') = require('should');

const testutils: typeof import('../../../../testutils/server/server.testutil.mts') = require('../../../../testutils/server/server.testutil');
require('./../../server/models/user.server.model.mjs');
const authController: typeof import('../../server/controllers/users.authentication.server.controller.mjs').default = require('./../../server/controllers/users.authentication.server.controller.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
require('should');

type AuthenticationUserRecord =
  import('../../server/models/user.server.types.mts').UserServerRecord;
type AuthenticationUserModel =
  import('../../server/models/user.server.types.mts').UserServerModel;
const User = mongoose.model<AuthenticationUserRecord, AuthenticationUserModel>(
  'User',
);
type AuthenticationUserDocument =
  import('../../server/models/user.server.types.mts').UserServerDocument;
type AuthCallback = (error?: Error | null) => void;
type MfaChallenge = { userId: string; authVersion: number; expiresAt: number };
type MfaSession = NonNullable<
  Parameters<typeof authController.verifyMfa>[0]['session']
>;
function mfaSession(challenge?: MfaChallenge): MfaSession {
  return {
    mfaChallenge: challenge,
    regenerate: callback => callback(),
    save: callback => callback(),
  };
}
function findOneResult(result: unknown) {
  return { exec: async () => result } as unknown as ReturnType<
    typeof User.findOne
  >;
}
type LegacyUserSave = (callback: (error?: Error) => void) => void;
type LegacyRandomBytes = (
  size: number,
  callback?: (error: Error | null, bytes?: Buffer) => void,
) => Buffer | void;
type SignupStats = { tags: { reason: string } };
function stubLegacyRandomBytes(): import('sinon').SinonStub<
  Parameters<LegacyRandomBytes>,
  ReturnType<LegacyRandomBytes>
> {
  const legacyCrypto = crypto as unknown as { randomBytes: LegacyRandomBytes };
  return sinon.stub(legacyCrypto, 'randomBytes');
}
function stubLegacySave(
  user: AuthenticationUserDocument,
): import('sinon').SinonStub<
  Parameters<LegacyUserSave>,
  ReturnType<LegacyUserSave>
> {
  const legacyUser = user as unknown as { save: LegacyUserSave };
  return sinon.stub(legacyUser, 'save');
}
async function findUser(id: unknown): Promise<AuthenticationUserDocument> {
  const user = await User.findById(id);
  if (!user) throw new Error('Expected test user to exist');
  return user;
}
const controllerPath =
  '../../server/controllers/users.authentication.server.controller.mts';

function stubControllerDependencies(
  dependencyStubs: Record<string, Record<string, unknown>>,
): typeof authController {
  for (const [dependencyPath, methods] of Object.entries(dependencyStubs)) {
    const dependency = require(dependencyPath) as Record<string, unknown>;
    for (const [method, implementation] of Object.entries(methods)) {
      if (typeof dependency[method] !== 'function') {
        throw new Error(
          `Expected ${method} to be a function in ${dependencyPath}`,
        );
      }
      if (typeof implementation !== 'function') {
        throw new Error(`Expected ${method} mock to be a function`);
      }
      const stubbableDependency = dependency as Record<
        string,
        (...args: unknown[]) => unknown
      >;
      sinon
        .stub(stubbableDependency, method)
        .callsFake((...args: unknown[]) =>
          Reflect.apply(implementation, dependency, args),
        );
    }
  }

  return authController;
}
/**
 * Express-like response mock that resolves a promise as soon as the controller
 * sends a response, so callback-based controllers can be awaited.
 */
interface AuthenticationResponseBody {
  mfaRequired?: boolean;
  message?: string;
  avatarSource?: string;
  password?: string;
  username?: string;
  valid?: boolean;
  error?: string;
  usernameUpdateAllowed?: boolean;
  profileMadePublic?: boolean;
  _id?: { toString(): string };
}
interface DeferredResponse {
  statusCode: number;
  body: AuthenticationResponseBody | null;
  redirectUrl: string | null;
  status(code: number): this;
  send(body: AuthenticationResponseBody): this;
  json(body: AuthenticationResponseBody): this;
  redirect(url: string): this;
  waitForResponse(): Promise<DeferredResponse>;
}
function deferredResponse(): DeferredResponse {
  let resolveResponse: (value: DeferredResponse) => void;
  const promise = new Promise<DeferredResponse>(resolve => {
    resolveResponse = resolve;
  });
  const res: DeferredResponse = {
    statusCode: 200,
    body: null,
    redirectUrl: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(body) {
      res.body = body;
      resolveResponse(res);
      return res;
    },
    json(body) {
      res.body = body;
      resolveResponse(res);
      return res;
    },
    redirect(url) {
      res.redirectUrl = url;
      resolveResponse(res);
      return res;
    },
    waitForResponse: () => promise,
  };

  return res;
}
function responseBody(res: DeferredResponse): AuthenticationResponseBody {
  if (res.body === null) throw new Error('Expected a response body');
  return res.body;
}
function responseField<Key extends keyof AuthenticationResponseBody>(
  res: DeferredResponse,
  key: Key,
): NonNullable<AuthenticationResponseBody[Key]> {
  const value = responseBody(res)[key];
  if (value === undefined) throw new Error(`Expected response field ${key}`);
  return value as NonNullable<AuthenticationResponseBody[Key]>;
}
function responseRedirect(res: DeferredResponse): string {
  if (res.redirectUrl === null) throw new Error('Expected a redirect URL');
  return res.redirectUrl;
}
function userField<Key extends keyof AuthenticationUserRecord>(
  user: AuthenticationUserDocument,
  key: Key,
): NonNullable<AuthenticationUserRecord[Key]> {
  const value = user.get(key);
  if (value === undefined || value === null)
    throw new Error(`Expected user field ${key}`);
  return value as NonNullable<AuthenticationUserRecord[Key]>;
}

describe('Authentication controller OAuth unit tests', () => {
  const jobs = testutils.catchJobs();

  afterEach(async () => {
    sinon.restore();
    jobs.length = 0;
    await utils.clearDatabase();
  });

  describe('removeOAuthProvider', () => {
    it('responds with 403 when there is no user', async () => {
      const res = deferredResponse();
      authController.removeOAuthProvider({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('responds with 400 for an unknown provider', async () => {
      const res = deferredResponse();
      authController.removeOAuthProvider(
        { user: new User({}), params: { provider: 'myspace' } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      responseField(res, 'message').should.equal('No provider defined.');
    });

    it('returns 400 when saving after removing a provider fails', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.additionalProvidersData = { github: { id: 'gh-1' } };
      userDoc.markModified('additionalProvidersData');
      await userDoc.save();
      stubLegacySave(userDoc).callsFake(cb => cb(new Error('save failed')));

      const req = {
        user: userDoc,
        params: { provider: 'github' },
        login: (user: unknown, cb: AuthCallback) => cb(),
      };
      const res = deferredResponse();

      authController.removeOAuthProvider(req, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns 400 when login fails after removing a provider', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.additionalProvidersData = { github: { id: 'gh-1' } };
      userDoc.markModified('additionalProvidersData');
      await userDoc.save();

      const req = {
        user: userDoc,
        params: { provider: 'github' },
        login: (user: unknown, cb: AuthCallback) =>
          cb(new Error('login failed')),
      };
      const res = deferredResponse();

      authController.removeOAuthProvider(req, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('removes the provider data and returns the sanitized user', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.additionalProvidersData = { github: { id: 'gh-1' } };
      userDoc.markModified('additionalProvidersData');
      await userDoc.save();

      const req = {
        user: userDoc,
        params: { provider: 'github' },
        login: (user: unknown, cb: AuthCallback) => cb(),
      };
      const res = deferredResponse();

      authController.removeOAuthProvider(req, res);
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      (responseBody(res).password === undefined).should.be.true();

      const reloaded = await findUser(saved._id);
      Boolean(
        reloaded.additionalProvidersData &&
        reloaded.additionalProvidersData.github,
      ).should.be.false();
    });

    it('keeps no photo when removing a legacy Facebook connection', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      await User.collection.updateOne(
        { _id: saved._id },
        {
          $set: {
            avatarSource: 'facebook',
            additionalProvidersData: {
              facebook: { id: 'fictional-facebook-id' },
            },
          },
        },
      );
      const userDoc = await findUser(saved._id);

      const req = {
        user: userDoc,
        params: { provider: 'facebook' },
        login: (user: unknown, cb: AuthCallback) => cb(),
      };
      const res = deferredResponse();

      authController.removeOAuthProvider(req, res);
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      responseField(res, 'avatarSource').should.equal('none');
      const reloaded = await findUser(saved._id);
      userField(reloaded, 'avatarSource').should.equal('none');
    });

    it('allows removing a provider that is not connected', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.additionalProvidersData = {};
      userDoc.markModified('additionalProvidersData');
      await userDoc.save();

      const req = {
        user: userDoc,
        params: { provider: 'facebook' },
        login: (user: unknown, cb: AuthCallback) => cb(),
      };
      const res = deferredResponse();

      authController.removeOAuthProvider(req, res);
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      responseField(res, '_id').toString().should.equal(userDoc._id.toString());
    });
  });

  describe('signout', () => {
    it('redirects after Passport logs the user out', async () => {
      const res = deferredResponse();

      authController.signout(
        { logout: (callback: AuthCallback) => callback() },
        res,
        () => {},
      );
      await res.waitForResponse();

      responseRedirect(res).should.equal('/');
    });

    it('forwards Passport logout errors', () => {
      const error = new Error('logout failed');
      const next = sinon.spy();

      authController.signout(
        { logout: (callback: AuthCallback) => callback(error) },
        deferredResponse(),
        next,
      );

      next.calledOnceWithExactly(error).should.be.true();
    });
  });

  describe('resendConfirmation', () => {
    it('responds with 403 when there is no user', async () => {
      const res = deferredResponse();
      authController.resendConfirmation({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('responds with 400 when the user is already confirmed', async () => {
      const res = deferredResponse();
      authController.resendConfirmation(
        { user: new User({ email: 'a@b.com' }) },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      responseField(res, 'message').should.equal('Already confirmed.');
    });

    it('resends the email-change confirmation email', async () => {
      const [saved] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      const userDoc = await findUser(saved._id);
      userDoc.emailTemporary = 'new-email@example.com';
      userDoc.emailToken = 'token';
      await userDoc.save();

      const res = deferredResponse();
      authController.resendConfirmation({ user: userDoc }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(200);
    });

    it('returns 400 when resending the confirmation email fails', async () => {
      const controller = stubControllerDependencies({
        './../../../core/server/services/email.server.service.mjs': {
          sendSignupEmailConfirmation: (user: unknown, cb: AuthCallback) =>
            cb(new Error('smtp down')),
        },
      });
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.public = false;
      userDoc.emailTemporary = userDoc.email;
      userDoc.emailToken = 'token';
      await userDoc.save();

      const res = deferredResponse();
      controller.resendConfirmation({ user: userDoc }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns 400 when generating a new confirmation token fails', async () => {
      const randomBytesStub = stubLegacyRandomBytes().callsFake((size, cb) => {
        if (typeof cb === 'function') {
          cb(new Error('entropy unavailable'));
          return;
        }

        return Buffer.alloc(size);
      });
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.public = false;
      userDoc.emailTemporary = userDoc.email;
      await userDoc.save();
      randomBytesStub.restore();
      stubLegacyRandomBytes().callsFake((size, cb) => {
        if (!cb) throw new Error('Expected callback-based randomBytes');
        cb(new Error('entropy unavailable'));
      });

      const res = deferredResponse();
      authController.resendConfirmation({ user: userDoc }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns 400 when saving the new confirmation token fails', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.public = false;
      userDoc.emailTemporary = userDoc.email;
      await userDoc.save();
      stubLegacySave(userDoc).callsFake(cb => cb(new Error('save failed')));

      const res = deferredResponse();
      authController.resendConfirmation({ user: userDoc }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('resends the signup confirmation email', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.public = false;
      userDoc.emailTemporary = userDoc.email;
      userDoc.emailToken = 'token';
      await userDoc.save();

      const res = deferredResponse();
      authController.resendConfirmation({ user: userDoc }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      responseField(res, 'message').should.equal('Sent confirmation email.');
    });
  });

  describe('signup', () => {
    function loadSignupController() {
      return stubControllerDependencies({
        './../../../core/server/services/email.server.service.mjs': {
          sendSignupEmailConfirmation: (user: unknown, cb: AuthCallback) =>
            cb(),
        },
      });
    }

    it('rejects missing required fields', async () => {
      const controller = loadSignupController();
      const res = deferredResponse();
      controller.signup({ body: { firstName: 'Ada' } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('rejects usernames with invalid characters', async () => {
      const controller = loadSignupController();
      const res = deferredResponse();
      controller.signup(
        {
          body: {
            firstName: 'Ada',
            lastName: 'Lovelace',
            username: 'has space',
            password: 'password123',
            email: 'ada@example.com',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('rejects spammy signup attempts', async () => {
      const controller = loadSignupController();
      const res = deferredResponse();
      controller.signup(
        {
          body: {
            firstName: 'Ada',
            lastName: 'Lovelace',
            username: 'has_underscore',
            password: 'password123',
            email: 'ada@example.com',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('keeps name-spam errors separate from username advice', async () => {
      const controller = loadSignupController();
      const res = deferredResponse();
      controller.signup(
        {
          body: {
            firstName: 'Amina',
            lastName: 'spam_name',
            username: 'samplemember',
            email: 'sample-member@example.org',
            password: 'password123',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      responseField(res, 'message').should.equal(
        'Snap! Something went wrong. If this keeps happening, please contact us.',
      );
    });

    it('keeps internal signup errors private', async () => {
      const controller = loadSignupController();
      stubLegacyRandomBytes().callsFake((size, callback) => {
        if (!callback) throw new Error('Expected callback-based randomBytes');
        callback(new Error('Internal secret detail'));
      });
      const res = deferredResponse();
      controller.signup(
        {
          body: {
            firstName: 'Amina',
            lastName: 'Vale',
            username: 'samplemember',
            email: 'sample-member@example.org',
            password: 'password123',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      responseField(res, 'message').should.equal(
        'Snap! Something went wrong. If this keeps happening, please contact us.',
      );
    });

    it('returns retryable service unavailable when password hashing is overloaded', async () => {
      const overload = Object.assign(
        new Error('Password service is temporarily busy. Please try again.'),
        { code: 'KDF_OVERLOADED', userFacing: true },
      );
      const controller = mockModule<typeof authController>(
        require.resolve(controllerPath),
        {
          async: {
            waterfall(steps: unknown[], done: (error?: unknown) => void) {
              done(overload);
            },
          },
          '../../../stats/server/services/stats.server.service.mts': {
            stat: (statsObject: unknown, callback: AuthCallback) => callback(),
          },
        },
      );
      const res = deferredResponse();

      controller.signup({ body: {} }, res);
      await res.waitForResponse();

      res.statusCode.should.equal(503);
      responseField(res, 'message').should.equal(overload.message);
    });

    it('creates a user and logs them in', async () => {
      const controller = loadSignupController();
      const res = deferredResponse();
      const req = {
        body: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          username: 'adalovelace',
          password: 'password123',
          email: 'ada-signup@example.com',
        },
        login: (user: unknown, cb: AuthCallback) => cb(),
      };
      controller.signup(req, res);
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      responseField(res, 'username').should.equal('adalovelace');
    });

    it('sends one alert after a matching user is saved', async () => {
      const sendFlaggedSignupAlert = sinon
        .stub()
        .callsFake(
          (user: unknown, matchedKeywords: string[], callback: AuthCallback) =>
            callback(),
        );
      const controller = stubControllerDependencies({
        './../../../core/server/services/email.server.service.mjs': {
          sendFlaggedSignupAlert,
          sendSignupEmailConfirmation: (
            user: unknown,
            callback: AuthCallback,
          ) => callback(),
        },
      });
      const res = deferredResponse();
      const req = {
        body: {
          firstName: 'TrustRoots',
          lastName: 'Member',
          username: 'flaggedmember',
          password: 'password123',
          email: 'flagged-signup@example.com',
        },
        login: (user: unknown, callback: AuthCallback) => callback(),
      };

      controller.signup(req, res);
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      sendFlaggedSignupAlert.calledOnce.should.be.true();
      sendFlaggedSignupAlert.firstCall.args[1].should.deepEqual(['trustroots']);
      const saved = await User.findOne({ username: 'flaggedmember' });
      should.exist(saved);
    });

    it('continues signup when flagged-alert delivery fails', async () => {
      const log = sinon.stub();
      sinon.stub(winston.Logger.prototype, 'log').callsFake(function (
        this: import('winston').Logger,
        ...args: unknown[]
      ) {
        log(...args);
        return this;
      });
      const controller = stubControllerDependencies({
        './../../../core/server/services/email.server.service.mjs': {
          sendFlaggedSignupAlert: (
            user: unknown,
            matchedKeywords: string[],
            callback: AuthCallback,
          ) => callback(new Error('alert mail failed')),
          sendSignupEmailConfirmation: (
            user: unknown,
            callback: AuthCallback,
          ) => callback(),
        },
      });
      const res = deferredResponse();
      const req = {
        body: {
          firstName: 'Support',
          lastName: 'Member',
          username: 'alertfailure',
          password: 'password123',
          email: 'alert-failure@example.com',
        },
        login: (user: unknown, callback: AuthCallback) => callback(),
      };

      controller.signup(req, res);
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      responseField(res, 'username').should.equal('alertfailure');
      log
        .calledWith(
          'error',
          'Flagged signup alert delivery failed.',
          sinon.match.has('error'),
        )
        .should.be.true();
    });

    it('returns an empty object when signup completes without a user', async () => {
      const controller = stubControllerDependencies({
        async: {
          waterfall(steps: unknown[], done: (error?: unknown) => void) {
            done(null);
          },
        },
        './../../../stats/server/services/stats.server.service.mts': {
          stat: (statsObject: unknown, callback: AuthCallback) => callback(),
        },
      });
      const res = deferredResponse();

      controller.signup(
        { body: {}, login: (user: unknown, cb: AuthCallback) => cb() },
        res,
      );
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      should(responseBody(res)).deepEqual({});
    });
  });

  describe('signupValidation', () => {
    it('rejects a missing username', async () => {
      const res = deferredResponse();
      authController.signupValidation({ body: {} }, res);
      await res.waitForResponse();
      responseField(res, 'valid').should.be.false();
      responseField(res, 'error').should.equal('username-missing');
    });

    it('rejects a reserved username', async () => {
      const res = deferredResponse();
      authController.signupValidation(
        { body: { username: 'trustroots' } },
        res,
      );
      await res.waitForResponse();
      responseField(res, 'valid').should.be.false();
      responseField(res, 'error').should.equal(
        'username-not-available-reserved',
      );
    });

    it('uses generic error metadata when validation fails without an error code', async () => {
      let stats: SignupStats | undefined;
      const controller = stubControllerDependencies({
        async: {
          waterfall(steps: unknown[], done: (error?: unknown) => void) {
            done({ errors: {} });
          },
        },
        './../../../stats/server/services/stats.server.service.mts': {
          stat: (statsObject: unknown, callback: AuthCallback) => {
            if (
              typeof statsObject !== 'object' ||
              statsObject === null ||
              !('tags' in statsObject)
            ) {
              throw new Error('Expected signup stats tags');
            }
            const tags = statsObject.tags;
            if (
              typeof tags !== 'object' ||
              tags === null ||
              !('reason' in tags) ||
              typeof tags.reason !== 'string'
            ) {
              throw new Error('Expected signup stats reason');
            }
            stats = { tags: { reason: tags.reason } };
            callback();
          },
        },
      });
      const res = deferredResponse();

      controller.signupValidation({ body: { username: 'anything' } }, res);
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      responseField(res, 'valid').should.be.false();
      responseField(res, 'error').should.equal('other');
      should.exist(stats);
      stats!.tags.reason.should.equal('other');
    });

    it('accepts an available username', async () => {
      const res = deferredResponse();
      authController.signupValidation(
        { body: { username: 'brandnewusername' } },
        res,
      );
      await res.waitForResponse();
      responseField(res, 'valid').should.be.true();
    });
  });

  describe('signin', () => {
    function loadSigninController(
      callback: () => [
        Error | null,
        AuthenticationUserDocument | { roles: string[] } | null,
        unknown,
      ],
    ): typeof authController {
      return stubControllerDependencies({
        passport: {
          authenticate:
            (
              strategy: string,
              authCallback: (this: null, ...args: unknown[]) => void,
            ) =>
            () =>
              Reflect.apply(authCallback, null, callback()),
        },
      });
    }

    it('rejects wrong credentials', async () => {
      const controller = loadSigninController(() => [
        null,
        null,
        { message: 'Invalid credentials' },
      ]);
      const res = deferredResponse();
      controller.signin({}, res, () => {});
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns retryable service unavailable for password hash overload', async () => {
      const overload = Object.assign(new Error('busy'), {
        code: 'KDF_OVERLOADED',
      });
      const controller = loadSigninController(() => [overload, null, null]);
      const res = deferredResponse();

      controller.signin({}, res, () => {});
      await res.waitForResponse();
      res.statusCode.should.equal(503);
      responseField(res, 'message').should.equal(
        'Password service is temporarily busy. Please try again.',
      );
    });

    it('rejects suspended users', async () => {
      const controller = loadSigninController(() => [
        null,
        { roles: ['user', 'suspended'] },
        null,
      ]);
      const res = deferredResponse();
      controller.signin({}, res, () => {});
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('logs in a valid user', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.created = new Date('2020-05-27T19:23:44.733Z');
      await userDoc.save();
      const controller = loadSigninController(() => [null, userDoc, null]);
      const res = deferredResponse();
      const req = { login: (user: unknown, cb: AuthCallback) => cb() };
      controller.signin(req, res, () => {});
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      responseField(res, '_id').toString().should.equal(userDoc._id.toString());
      responseField(res, 'usernameUpdateAllowed').should.be.true();
    });

    it('returns 400 when login fails after authentication', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      const controller = loadSigninController(() => [null, userDoc, null]);
      const res = deferredResponse();
      const req = {
        login: (user: unknown, cb: AuthCallback) =>
          cb(new Error('login failed')),
      };
      controller.signin(req, res, () => {});
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns unavailable when a new MFA challenge cannot regenerate the session', async () => {
      const controller = loadSigninController(() => [
        null,
        { _id: 'fictional-user', roles: ['user'], mfaEnabled: true },
        null,
      ]);
      const res = deferredResponse();

      controller.signin(
        {
          session: {
            regenerate: callback => callback(new Error('session failed')),
            save: callback => callback(),
          },
        },
        res,
        () => {},
      );

      await res.waitForResponse();
      res.statusCode.should.equal(503);
      responseField(res, 'message').should.equal(
        'Could not start MFA verification.',
      );
    });

    it('returns unavailable when a new MFA challenge cannot be saved', async () => {
      const controller = loadSigninController(() => [
        null,
        { _id: 'fictional-user', roles: ['user'], mfaEnabled: true },
        null,
      ]);
      const res = deferredResponse();
      const req: Parameters<typeof authController.signin>[0] = {
        session: {
          save: saveCallback => saveCallback(new Error('save failed')),
          regenerate: callback => callback(),
        },
      };

      controller.signin(req, res, () => {});

      await res.waitForResponse();
      res.statusCode.should.equal(503);
    });

    it('starts a short-lived challenge instead of creating an MFA session', async () => {
      const controller = loadSigninController(() => [
        null,
        {
          _id: 'fictional-user',
          authVersion: 2,
          roles: ['user'],
          mfaEnabled: true,
        },
        null,
      ]);
      const res = deferredResponse();
      const session: MfaSession = mfaSession();

      controller.signin({ session }, res, () => {});

      await res.waitForResponse();
      res.statusCode.should.equal(202);
      responseField(res, 'mfaRequired').should.be.true();
      session.mfaChallenge!.userId.should.equal('fictional-user');
      session.mfaChallenge!.authVersion.should.equal(2);
    });
  });

  describe('MFA challenge verification', () => {
    const mfaService = require('./../../server/services/mfa.server.service.mjs');

    function challenge() {
      return mfaService.createChallenge({
        _id: 'fictional-user',
        authVersion: 2,
      });
    }

    async function createMfaChallenge() {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
      await User.updateOne(
        { _id: saved._id },
        {
          $set: {
            authVersion: 2,
            mfaEnabled: true,
            mfaSecretEncrypted: mfaService.encryptSecret(secret),
            mfaLastTotpCounter: -1,
          },
        },
      );
      const user = await User.findById(saved._id);
      sinon.stub(Date, 'now').returns(59000);
      return {
        challenge: mfaService.createChallenge(user),
        user,
        code: '287082',
      };
    }

    it('rejects a missing or expired challenge', async () => {
      const res = deferredResponse();
      await authController.verifyMfa({ session: mfaSession() }, res);
      res.statusCode.should.equal(401);
    });

    it('clears a challenge for a missing or suspended account', async () => {
      const lookup = sinon.stub(User, 'findOne').returns(findOneResult(null));
      const session = mfaSession(challenge());
      const res = deferredResponse();

      await authController.verifyMfa({ session, body: {} }, res);

      res.statusCode.should.equal(401);
      should.not.exist(session.mfaChallenge);

      lookup.restore();
      sinon.stub(User, 'findOne').returns(
        findOneResult({
          _id: 'fictional-user',
          roles: ['user', 'suspended'],
          mfaEnabled: true,
        }),
      );
      const suspendedSession = mfaSession(challenge());
      const suspendedResponse = deferredResponse();
      await authController.verifyMfa(
        { session: suspendedSession, body: {} },
        suspendedResponse,
      );
      suspendedResponse.statusCode.should.equal(401);
      should.not.exist(suspendedSession.mfaChallenge);
    });

    it('rejects an invalid authenticator code', async () => {
      const { challenge } = await createMfaChallenge();
      const res = deferredResponse();

      await authController.verifyMfa(
        { session: mfaSession(challenge), body: { code: '000000' } },
        res,
      );

      res.statusCode.should.equal(400);
    });

    it('reports a session update failure after consuming a valid code', async () => {
      const { challenge, code } = await createMfaChallenge();
      const res = deferredResponse();

      await authController.verifyMfa(
        {
          session: mfaSession(challenge),
          body: { code },
          login: (user, callback) => callback(new Error('session failed')),
        },
        res,
      );

      res.statusCode.should.equal(503);
    });

    it('completes sign-in after a valid second factor', async () => {
      const { challenge, code, user } = await createMfaChallenge();
      const res = deferredResponse();

      await authController.verifyMfa(
        {
          session: mfaSession(challenge),
          body: { code },
          login: (authenticatedUser, callback) => callback(null),
        },
        res,
      );

      res.statusCode.should.equal(200);
      responseField(res, '_id').toString().should.equal(user!._id.toString());
    });

    it('returns unavailable when the account lookup fails', async () => {
      sinon.stub(User, 'findOne').returns({
        exec: async () => {
          throw new Error('database unavailable');
        },
      } as unknown as ReturnType<typeof User.findOne>);
      const res = deferredResponse();

      await authController.verifyMfa(
        { session: mfaSession(challenge()), body: {} },
        res,
      );

      res.statusCode.should.equal(503);
    });
  });

  describe('confirmEmail', () => {
    it('redirects invalid email tokens to the invalid confirmation page', async () => {
      const res = deferredResponse();
      authController.validateEmailToken({ params: { token: 'missing' } }, res);
      await res.waitForResponse();

      responseRedirect(res).should.equal('/confirm-email-invalid');
    });

    it('redirects valid email tokens to the confirmation page', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.emailTemporary = userDoc.email;
      userDoc.emailToken = 'valid-token';
      userDoc.emailTokenIssuedAt = new Date();
      userDoc.emailTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
      await userDoc.save();

      const res = deferredResponse();
      authController.validateEmailToken(
        { params: { token: 'valid-token' } },
        res,
      );
      await res.waitForResponse();

      responseRedirect(res).should.equal('/confirm-email/valid-token');
    });

    it('confirms a signup email token', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.public = false;
      userDoc.authVersion = 1;
      userDoc.emailTemporary = userDoc.email;
      userDoc.emailToken = 'confirm-token';
      userDoc.emailTokenIssuedAt = new Date();
      userDoc.emailTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
      await userDoc.save();

      const res = deferredResponse();
      authController.confirmEmail(
        {
          params: { token: 'confirm-token' },
          login: (user: unknown, cb: AuthCallback) => cb(),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      responseField(res, 'profileMadePublic').should.be.true();

      const reloaded = await findUser(saved._id);
      userField(reloaded, 'public').should.be.true();
      should.not.exist(reloaded.emailToken);
    });

    it('rejects an expired confirmation on both validation and consumption', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const expiredAt = new Date(Date.now() - 1);
      await User.updateOne(
        { _id: saved._id },
        {
          $set: {
            public: false,
            emailTemporary: saved.email,
            emailToken: 'expired-confirm-token',
            emailTokenIssuedAt: new Date(expiredAt.getTime() - 86400000),
            emailTokenExpires: expiredAt,
          },
        },
      );

      const validation = deferredResponse();
      authController.validateEmailToken(
        { params: { token: 'expired-confirm-token' } },
        validation,
      );
      await validation.waitForResponse();
      responseRedirect(validation).should.equal('/confirm-email-invalid');

      const confirmation = deferredResponse();
      authController.confirmEmail(
        { params: { token: 'expired-confirm-token' } },
        confirmation,
      );
      await confirmation.waitForResponse();
      confirmation.statusCode.should.equal(400);

      const unchanged = await findUser(saved._id);
      userField(unchanged, 'public').should.be.false();
      userField(unchanged, 'emailTemporary').should.equal(saved.email);
    });

    it('rejects legacy tokens on 1 November 2026', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      await User.updateOne(
        { _id: saved._id },
        {
          $set: {
            public: false,
            emailTemporary: saved.email,
            emailToken: 'legacy-confirm-token',
          },
          $unset: {
            emailTokenIssuedAt: 1,
            emailTokenExpires: 1,
          },
        },
      );
      const clock = sinon.useFakeTimers({
        now: new Date('2026-11-01T00:00:00.000Z').getTime(),
        toFake: ['Date'],
      });

      try {
        const res = deferredResponse();
        authController.confirmEmail(
          { params: { token: 'legacy-confirm-token' } },
          res,
        );
        await res.waitForResponse();
        res.statusCode.should.equal(400);
        const unchanged = await findUser(saved._id);
        userField(unchanged, 'public').should.be.false();
      } finally {
        clock.restore();
      }
    });

    it('consumes a confirmation only once when requests race', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const token = 'single-use-confirm-token';
      await User.updateOne(
        { _id: saved._id },
        {
          $set: {
            public: false,
            emailTemporary: saved.email,
            emailToken: token,
            emailTokenIssuedAt: new Date(),
            emailTokenExpires: new Date(Date.now() + 86400000),
          },
        },
      );

      const submit = async () => {
        const res = deferredResponse();
        authController.confirmEmail(
          {
            params: { token },
            login: (_user: unknown, callback: AuthCallback) => callback(),
          },
          res,
        );
        await res.waitForResponse();
        return res;
      };
      const responses = await Promise.all([submit(), submit()]);
      responses
        .map(res => res.statusCode)
        .sort()
        .should.deepEqual([200, 400]);

      const confirmed = await findUser(saved._id);
      userField(confirmed, 'public').should.be.true();
      should.not.exist(confirmed.emailToken);
      should.not.exist(confirmed.emailTokenExpires);
    });

    it('does not authenticate from a confirmation when authVersion changes mid-request', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const token = 'stale-confirm-token';
      const pendingEmail = 'pending@example.test';
      await User.updateOne(
        { _id: saved._id },
        {
          $set: {
            public: false,
            emailTemporary: pendingEmail,
            emailToken: token,
            emailTokenIssuedAt: new Date(),
            emailTokenExpires: new Date(Date.now() + 86400000),
          },
        },
      );

      type LegacyFindOneAndUpdate = (
        filter: Parameters<typeof User.findOneAndUpdate>[0],
        update: Parameters<typeof User.findOneAndUpdate>[1],
        options: Parameters<typeof User.findOneAndUpdate>[2],
        callback: (
          error: Error | null,
          document: AuthenticationUserDocument | null,
          result?: unknown,
        ) => void,
      ) => void;
      const originalFindOneAndUpdate =
        User.findOneAndUpdate as unknown as LegacyFindOneAndUpdate;
      const legacyUserModel = User as unknown as {
        findOneAndUpdate: LegacyFindOneAndUpdate;
      };
      sinon
        .stub(legacyUserModel, 'findOneAndUpdate')
        .callsFake((filter, update, options, callback) => {
          User.updateOne({ _id: saved._id }, { $inc: { authVersion: 1 } }).then(
            () => {
              originalFindOneAndUpdate.call(
                User,
                filter,
                update,
                options,
                callback,
              );
            },
            error => callback(error, null),
          );
        });

      const login = sinon.spy((_user: unknown, callback: AuthCallback) =>
        callback(),
      );
      const res = deferredResponse();
      authController.confirmEmail({ params: { token }, login }, res);
      await res.waitForResponse();

      res.statusCode.should.equal(400);
      login.called.should.be.false();
      const unchanged = await findUser(saved._id);
      userField(unchanged, 'authVersion').should.equal(1);
      userField(unchanged, 'public').should.be.false();
      userField(unchanged, 'emailTemporary').should.equal(pendingEmail);
      userField(unchanged, 'emailToken').should.equal(token);
    });

    it('confirms an email when the account already has an auth version', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const token = 'versioned-confirm-token';
      await User.updateOne(
        { _id: saved._id },
        {
          $set: {
            public: false,
            emailTemporary: saved.email,
            emailToken: token,
            emailTokenIssuedAt: new Date(),
            emailTokenExpires: new Date(Date.now() + 86400000),
            authVersion: 2,
          },
        },
      );

      const res = deferredResponse();
      authController.confirmEmail(
        {
          params: { token },
          login: (_user: unknown, cb: AuthCallback) => cb(),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);

      const reloaded = await findUser(saved._id);
      userField(reloaded, 'public').should.be.true();
      userField(reloaded, 'authVersion').should.equal(2);
      should.not.exist(reloaded.emailToken);
    });

    it('does not authenticate from a confirmation when authVersion changes mid-request', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const token = 'stale-confirm-token';
      const pendingEmail = 'pending@example.test';
      await User.updateOne(
        { _id: saved._id },
        {
          $set: {
            public: false,
            emailTemporary: pendingEmail,
            emailToken: token,
          },
        },
      );

      const originalFindOneAndUpdate = User.findOneAndUpdate;
      sinon
        .stub(User, 'findOneAndUpdate')
        .callsFake((filter, update, options, callback) => {
          User.updateOne({ _id: saved._id }, { $inc: { authVersion: 1 } }).then(
            () => {
              originalFindOneAndUpdate.call(
                User,
                filter,
                update,
                options,
                callback,
              );
            },
            callback,
          );
        });

      const login = sinon.spy((_user, callback) => callback());
      const res = deferredResponse();
      authController.confirmEmail({ params: { token }, login }, res);
      await res.waitForResponse();

      res.statusCode.should.equal(400);
      login.called.should.be.false();
      const unchanged = await User.findById(saved._id);
      unchanged.authVersion.should.equal(1);
      unchanged.public.should.be.false();
      unchanged.emailTemporary.should.equal(pendingEmail);
      unchanged.emailToken.should.equal(token);
    });

    it('does not create a session when confirming email for an MFA account', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      await User.updateOne(
        { _id: saved._id },
        {
          $set: {
            mfaEnabled: true,
            mfaSecretEncrypted: 'encrypted-secret',
            authVersion: 2,
            emailTemporary: 'new@example.test',
            emailToken: 'mfa-confirm-token',
          },
        },
      );
      const login = sinon.spy((user, cb) => cb());
      const res = deferredResponse();

      authController.confirmEmail(
        {
          params: { token: 'mfa-confirm-token' },
          login,
        },
        res,
      );
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      responseField(res, 'mfaRequired').should.be.true();
      login.called.should.be.false();
    });

    it('preserves an already MFA-verified session for a changed email', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      await User.updateOne(
        { _id: saved._id },
        {
          $set: {
            mfaEnabled: true,
            mfaSecretEncrypted: 'encrypted-secret',
            authVersion: 2,
            emailTemporary: 'new@example.test',
            emailToken: 'verified-confirm-token',
          },
        },
      );
      const login = sinon.spy((user, cb) => cb());
      const res = deferredResponse();

      authController.confirmEmail(
        {
          params: { token: 'verified-confirm-token' },
          user: Object.assign((await User.findById(saved._id))!, {
            $locals: { mfaVerified: true },
          }),
          login,
        },
        res,
      );
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      responseField(res, 'mfaRequired').should.be.false();
      login.calledOnce.should.be.true();
    });

    it('does not preserve an MFA session with a stale authVersion', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      await User.updateOne(
        { _id: saved._id },
        {
          $set: {
            mfaEnabled: true,
            mfaSecretEncrypted: 'encrypted-secret',
            authVersion: 2,
            emailTemporary: 'new@example.test',
            emailToken: 'stale-session-confirm-token',
          },
        },
      );
      const login = sinon.spy((user, cb) => cb());
      const res = deferredResponse();

      authController.confirmEmail(
        {
          params: { token: 'stale-session-confirm-token' },
          user: {
            _id: saved._id,
            authVersion: 1,
            $locals: { mfaVerified: true },
          },
          login,
        },
        res,
      );
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      res.body.mfaRequired.should.be.true();
      login.called.should.be.false();
    });

    it('returns 400 when the token is invalid', async () => {
      const res = deferredResponse();
      authController.confirmEmail({ params: { token: 'missing' } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns 400 when updating the confirmed user fails', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.public = false;
      userDoc.emailTemporary = userDoc.email;
      userDoc.emailToken = 'confirm-token';
      userDoc.emailTokenIssuedAt = new Date();
      userDoc.emailTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
      await userDoc.save();

      sinon.stub(User, 'findOneAndUpdate').yields(new Error('update failed'));

      const res = deferredResponse();
      authController.confirmEmail(
        {
          params: { token: 'confirm-token' },
          login: (user: unknown, cb: AuthCallback) => cb(),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });
  });
});
