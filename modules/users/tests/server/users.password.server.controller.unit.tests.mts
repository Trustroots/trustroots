import mockModule from '../../../../testutils/server/mock-module.mts';
import mongoose from 'mongoose';
import sinon from 'sinon';
import * as utils from '../../../../testutils/server/data.server.testutil.mts';
import * as testutils from '../../../../testutils/server/server.testutil.mts';
import errorService from '../../../core/server/services/error.server.service.mts';
import should from 'should';
import type { UserStatics } from '../../../../testutils/server/model-contracts.mts';
import importedDependency0 from 'crypto';

type UserRecord =
  import('../../../../testutils/server/model-contracts.mts').UserRecord;
interface PasswordUserRecord extends UserRecord {
  resetPasswordExpires?: Date;
}
type PasswordUserDocument =
  import('mongoose').HydratedDocument<PasswordUserRecord>;
type PasswordUserModel = import('mongoose').Model<PasswordUserRecord> &
  UserStatics;
const User = mongoose.model<PasswordUserRecord, PasswordUserModel>('User');
interface PasswordBody {
  username?: string;
  newPassword?: string;
  verifyPassword?: string;
  currentPassword?: string;
}
interface PasswordRequest {
  body?: PasswordBody;
  params?: { token?: string };
  query?: { utm_source?: string; utm_medium?: string; utm_campaign?: string };
  user?: { id: string };
  mobileSession?: { id: string };
  login?: (
    user: PasswordUserDocument,
    callback: (error?: Error | null) => void,
  ) => void;
}
interface PasswordResponseBody {
  message?: string;
  username?: string;
}
interface DeferredResponse {
  statusCode: number;
  body: PasswordResponseBody;
  redirectUrl: string | null;
  status(code: number): this;
  send(body: PasswordResponseBody): this;
  json(body: PasswordResponseBody): this;
  redirect(url: string): this;
  waitForResponse(): Promise<DeferredResponse>;
}
interface PasswordController {
  forgot(
    request: PasswordRequest,
    response: DeferredResponse,
    next?: () => void,
  ): void;
  validateResetToken(
    request: PasswordRequest,
    response: DeferredResponse,
  ): void;
  reset(
    request: PasswordRequest,
    response: DeferredResponse,
    next?: () => void,
  ): void;
  changePassword(
    request: PasswordRequest,
    response: DeferredResponse,
    next?: () => void,
  ): void;
}

const controllerPath =
  '../../server/controllers/users.password.server.controller.mts';
const emailServicePath =
  '../../../core/server/services/email.server.service.mts';

function deferredResponse(): DeferredResponse {
  let resolveResponse: (response: DeferredResponse) => void = () => {};
  const promise = new Promise<DeferredResponse>(resolve => {
    resolveResponse = resolve;
  });
  const res: DeferredResponse = {
    statusCode: 200,
    body: {},
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
    waitForResponse() {
      return promise;
    },
  };
  return res;
}

async function findUser(id: unknown): Promise<PasswordUserDocument> {
  const user = await User.findById(id);
  if (!user) throw new Error('Expected test user to exist');
  return user;
}

async function loadPasswordController(): Promise<PasswordController> {
  return (
    await mockModule<{ default: PasswordController }>(
      new URL(controllerPath, import.meta.url),
      {
        [emailServicePath]: {
          sendResetPassword: (
            user: PasswordUserDocument,
            cb: (error?: Error) => void,
          ) => cb(),
          sendResetPasswordConfirm: (
            user: PasswordUserDocument,
            cb: (error?: Error) => void,
          ) => cb(),
        },
      },
    )
  ).default;
}

interface LookupUserDouble {
  email?: string;
  username?: string;
  save(callback: (error?: Error | null) => void): void;
}
type LegacyFindOneStub = import('sinon').SinonStub<
  [
    import('mongoose').QueryFilter<PasswordUserRecord>,
    unknown,
    (error: Error | null, user: LookupUserDouble | null) => void,
  ],
  void
>;
function stubLegacyFindOne(): LegacyFindOneStub {
  return sinon.stub(User, 'findOne') as unknown as LegacyFindOneStub;
}
type FailedUpdateStub = import('sinon').SinonStub<
  [
    unknown,
    unknown,
    unknown,
    (error: Error | null, user?: PasswordUserDocument | null) => void,
  ],
  void
>;
type FailedLookupStub = import('sinon').SinonStub<
  [unknown, (error: Error | null, user?: PasswordUserDocument | null) => void],
  void
>;

describe('Password controller unit tests', () => {
  const jobs = testutils.catchJobs();

  afterEach(async () => {
    sinon.restore();
    jobs.length = 0;
    await utils.clearDatabase();
  });

  describe('forgot', () => {
    it('requires a username or email', async () => {
      const controller = await loadPasswordController();
      const res = deferredResponse();
      controller.forgot({ body: {} }, res, () => {});
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns the generic acknowledgement when the account does not exist', async () => {
      const controller = await loadPasswordController();
      const res = deferredResponse();
      controller.forgot({ body: { username: 'nobody-here' } }, res, () => {});
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.message!.should.equal(
        'If an account matches that username or email, we will send recovery instructions.',
      );
    });

    it('returns the same acknowledgement when sending the reset email fails', async () => {
      let resolveEmailAttempt: () => void = () => {};
      const emailAttempted = new Promise<void>(resolve => {
        resolveEmailAttempt = resolve;
      });
      const controller = (
        await mockModule<{ default: PasswordController }>(
          new URL(controllerPath, import.meta.url),
          {
            [emailServicePath]: {
              sendResetPassword: (
                _user: PasswordUserDocument,
                cb: (error?: Error) => void,
              ) => {
                cb(new Error('smtp down'));
                resolveEmailAttempt();
              },
            },
          },
        )
      ).default;
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      const res = deferredResponse();
      controller.forgot(
        { body: { username: userDoc.username } },
        res,
        () => {},
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.message!.should.equal(
        'If an account matches that username or email, we will send recovery instructions.',
      );
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          emailAttempted,
          new Promise<never>((_resolve, reject) => {
            timeout = setTimeout(
              () => reject(new Error('Reset email was not attempted')),
              5000,
            );
          }),
        ]);
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    });

    it('acknowledges before a stalled email provider responds', async () => {
      let startDelivery: () => void = () => {};
      const deliveryStarted = new Promise<void>(resolve => {
        startDelivery = resolve;
      });
      const controller = (
        await mockModule<{ default: PasswordController }>(
          new URL(controllerPath, import.meta.url),
          {
            [emailServicePath]: {
              sendResetPassword: () => {
                startDelivery();
              },
            },
          },
        )
      ).default;
      const fakeUser: LookupUserDouble = {
        save: () => Promise.resolve(),
      };
      stubLegacyFindOne().callsFake(() => Promise.resolve(fakeUser));
      const res = deferredResponse();

      controller.forgot({ body: { username: 'known-member' } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.message!.should.equal(
        'If an account matches that username or email, we will send recovery instructions.',
      );

      await deliveryStarted;
    });

    it('sends a reset email for a valid account', async () => {
      const controller = await loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      const res = deferredResponse();
      controller.forgot(
        { body: { username: userDoc.username } },
        res,
        () => {},
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.message!.should.equal(
        'If an account matches that username or email, we will send recovery instructions.',
      );
    });

    it('returns the generic acknowledgement when saving the reset token fails', async () => {
      const controller = await loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);

      stubLegacyFindOne().callsFake(() =>
        Promise.resolve({
          email: userDoc.email,
          username: userDoc.username,
          save: () => Promise.reject(new Error('save failed')),
        }),
      );

      const res = deferredResponse();
      controller.forgot({ body: { username: userDoc.username } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.message!.should.equal(
        'If an account matches that username or email, we will send recovery instructions.',
      );
    });
  });

  describe('validateResetToken', () => {
    it('redirects invalid tokens to the invalid page', async () => {
      const controller = await loadPasswordController();
      const res = deferredResponse();
      controller.validateResetToken(
        { body: {}, params: { token: 'bad-token' } },
        res,
      );
      await res.waitForResponse();
      res.redirectUrl!.should.equal('/password/reset/invalid');
    });

    it('redirects valid tokens to the reset form', async () => {
      const controller = await loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.resetPasswordToken = 'valid-token';
      userDoc.resetPasswordExpires = new Date(Date.now() + 3600000);
      await userDoc.save();

      const res = deferredResponse();
      controller.validateResetToken(
        { body: {}, params: { token: 'valid-token' } },
        res,
      );
      await res.waitForResponse();
      res.redirectUrl!.should.equal('/password/reset/valid-token');
    });

    it('preserves UTM parameters on valid token redirects', async () => {
      const controller = await loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.resetPasswordToken = 'valid-token';
      userDoc.resetPasswordExpires = new Date(Date.now() + 3600000);
      await userDoc.save();

      const res = deferredResponse();
      controller.validateResetToken(
        {
          body: {},
          params: { token: 'valid-token' },
          query: {
            utm_source: 'newsletter',
            utm_medium: 'email',
            utm_campaign: 'reset',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.redirectUrl!.should.containEql('/password/reset/valid-token');
      res.redirectUrl!.should.containEql('utm_source=newsletter');
      res.redirectUrl!.should.containEql('utm_medium=email');
      res.redirectUrl!.should.containEql('utm_campaign=reset');
    });
  });

  describe('reset', () => {
    it('rejects an invalid token', async () => {
      const controller = await loadPasswordController();
      const res = deferredResponse();
      controller.reset(
        {
          params: { token: 'missing' },
          body: { newPassword: 'newpass', verifyPassword: 'newpass' },
          login: () => {},
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('resets the password and logs the user in', async () => {
      const controller = await loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.resetPasswordToken = 'reset-token';
      userDoc.resetPasswordExpires = new Date(Date.now() + 3600000);
      await userDoc.save();

      const res = deferredResponse();
      controller.reset(
        {
          params: { token: 'reset-token' },
          body: {
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.username!.should.equal(userDoc.username);
    });

    it('returns 400 when login fails after reset', async () => {
      const controller = await loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.resetPasswordToken = 'reset-token';
      userDoc.resetPasswordExpires = new Date(Date.now() + 3600000);
      await userDoc.save();

      const res = deferredResponse();
      controller.reset(
        {
          params: { token: 'reset-token' },
          body: {
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(new Error('login failed')),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns 400 when saving the reset password fails', async () => {
      const controller = await loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.resetPasswordToken = 'reset-token';
      userDoc.resetPasswordExpires = new Date(Date.now() + 3600000);
      await userDoc.save();

      (
        sinon.stub(User, 'findOneAndUpdate') as unknown as FailedUpdateStub
      ).rejects(new Error('save failed'));

      const res = deferredResponse();
      controller.reset(
        {
          params: { token: 'reset-token' },
          body: {
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message!.should.equal('Password reset failed.');
    });

    it('rejects mismatched passwords', async () => {
      const controller = await loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.resetPasswordToken = 'reset-token';
      userDoc.resetPasswordExpires = new Date(Date.now() + 3600000);
      await userDoc.save();

      const res = deferredResponse();
      controller.reset(
        {
          params: { token: 'reset-token' },
          body: { newPassword: 'newpass', verifyPassword: 'different' },
          login: () => {},
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message!.should.equal('Passwords do not match.');
    });

    it('still resets the password when the confirmation email fails', async () => {
      const controller = (
        await mockModule<{ default: PasswordController }>(
          new URL(controllerPath, import.meta.url),
          {
            [emailServicePath]: {
              sendResetPassword: (
                user: PasswordUserDocument,
                cb: (error?: Error) => void,
              ) => cb(),
              sendResetPasswordConfirm: (
                user: PasswordUserDocument,
                cb: (error?: Error) => void,
              ) => cb(new Error('confirm email failed')),
            },
          },
        )
      ).default;
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.resetPasswordToken = 'reset-token';
      userDoc.resetPasswordExpires = new Date(Date.now() + 3600000);
      await userDoc.save();

      const res = deferredResponse();
      controller.reset(
        {
          params: { token: 'reset-token' },
          body: {
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.username!.should.equal(userDoc.username);
    });
  });

  describe('changePassword', () => {
    it('responds with 403 without a user', async () => {
      const controller = await loadPasswordController();
      const res = deferredResponse();
      controller.changePassword({ body: {} }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('requires a new password', async () => {
      const controller = await loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      controller.changePassword(
        { user: { id: saved._id.toString() }, body: {} },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('rejects mismatched new passwords', async () => {
      const controller = await loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: saved._id.toString() },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'different-password',
          },
          login: () => {},
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message!.should.equal('Passwords do not match.');
    });

    it('rejects a password change after the user has been deleted', async () => {
      const controller = await loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      await User.deleteOne({ _id: saved._id });
      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: saved._id.toString() },
          body: {
            currentPassword: 'oldpassword123',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: () => {},
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message!.should.equal('Current password is incorrect.');
    });

    it('rejects an incorrect current password', async () => {
      const controller = await loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.password = 'oldpassword1';
      await userDoc.save();

      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: saved._id.toString() },
          body: {
            currentPassword: 'wrong-password',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: () => {},
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message!.should.equal('Current password is incorrect.');
    });

    it('uses error status and default message for password lookup failures', async () => {
      const controller = await loadPasswordController();
      const lookupError = Object.assign(new Error(''), { status: 418 });
      (sinon.stub(User, 'findById') as unknown as FailedLookupStub).rejects(
        lookupError,
      );

      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: new mongoose.Types.ObjectId().toString() },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: () => {},
        },
        res,
      );
      await res.waitForResponse();

      res.statusCode.should.equal(418);
      res.body.message!.should.equal(
        errorService.getErrorMessageByKey('default'),
      );
    });

    it('changes the password for a valid user', async () => {
      const controller = await loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.password = 'oldpassword1';
      await userDoc.save();

      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: saved._id.toString() },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.message!.should.equal('Password changed successfully!');
    });

    it('does not create a browser session for a mobile password change', async () => {
      const controller = await loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.password = 'oldpassword1';
      await userDoc.save();

      const res = deferredResponse();
      controller.changePassword(
        {
          mobileSession: { id: 'mobile-session-id' },
          user: { id: saved._id.toString() },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: () => {
            throw new Error(
              'mobile requests must not create a browser session',
            );
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.message!.should.equal('Password changed successfully!');
    });

    it('returns 400 when login fails after changing the password', async () => {
      const controller = await loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.password = 'oldpassword1';
      await userDoc.save();

      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: saved._id.toString() },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(new Error('login failed')),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message!.should.equal('login failed');
    });

    it('still succeeds when the password change confirmation email fails', async () => {
      const controller = (
        await mockModule<{ default: PasswordController }>(
          new URL(controllerPath, import.meta.url),
          {
            [emailServicePath]: {
              sendResetPassword: (
                user: PasswordUserDocument,
                cb: (error?: Error) => void,
              ) => cb(),
              sendResetPasswordConfirm: (
                user: PasswordUserDocument,
                cb: (error?: Error) => void,
              ) => cb(new Error('confirm email failed')),
            },
          },
        )
      ).default;
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.password = 'oldpassword1';
      await userDoc.save();

      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: saved._id.toString() },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.message!.should.equal('Password changed successfully!');
    });
  });
});

describe('Password controller direct unit tests', () => {
  type Callback = (error?: Error | null) => void;
  interface PasswordBody {
    username?: string;
    newPassword?: string;
    verifyPassword?: string;
    currentPassword?: string;
    message?: string;
  }
  interface ResponseBody extends PasswordBody {
    [key: string]: unknown;
  }
  interface MockResponse {
    statusCode: number;
    body: ResponseBody | null;
    status(code: number): this;
    send(body: ResponseBody): this;
    json(body: ResponseBody): this;
    redirect(url: string): this;
    waitForResponse(): Promise<MockResponse>;
  }
  interface PasswordRequest {
    body?: PasswordBody;
    params?: { token: string };
    user?: { id: string; $locals?: { mfaVerified?: boolean } };
    logout?: (callback: Callback) => void;
    login?: (user: TestUser, callback: Callback) => void;
  }
  interface PasswordUpdate {
    $set?: { password?: string; passwordUpdated?: Date };
    $unset?: Record<string, 1>;
    $inc?: { authVersion?: number };
  }
  interface TestUser {
    [key: string]: unknown;
    displayName: string;
    email: string;
    password: string;
    salt?: string;
    authVersion?: number;
    $locals?: { mfaVerified?: boolean };
    lastPasswordUpdate?: {
      query: Record<string, unknown>;
      update: PasswordUpdate;
      options: { new?: boolean; runValidators?: boolean };
    };
    save(): Promise<void>;
    authenticate(password: string): Promise<boolean>;
  }
  type Method = 'forgot' | 'reset' | 'changePassword';
  type Controller = Record<
    Method,
    (request: PasswordRequest, response: MockResponse) => void
  >;
  interface LoadOptions {
    user?: TestUser;
    resetEmailError?: Error;
    confirmEmailError?: Error;
    hashPassword?: (password: string) => Promise<string>;
    findOneError?: Error;
    findOneAndUpdateError?: Error;
    findOneAndUpdateUser?: TestUser | null;
    validPassword?: boolean;
    randomBytes?: (
      length: number,
      callback: (error: Error | null, buffer?: Buffer) => void,
    ) => void;
  }
  interface StatPayload {
    namespace: string;
    counts: { count: number };
    tags: { status: string };
  }
  interface Calls {
    logs: unknown[][];
    stats: StatPayload[];
    lookups: unknown[][];
    confirmations: unknown[];
    statRecorded: Promise<void>;
  }

  let calls: Calls;

  function deferredResponse(): MockResponse {
    let resolveResponse: (response: MockResponse) => void = () => {};
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
      json: body => res.send(body),
      redirect: url => res.send({ message: url }),
      waitForResponse: () => promise,
    };
    return res;
  }

  async function loadController({
    user,
    resetEmailError,
    confirmEmailError,
    hashPassword,
    findOneError,
    findOneAndUpdateError,
    findOneAndUpdateUser = user || null,
    validPassword = true,
    randomBytes,
  }: LoadOptions = {}): Promise<Controller> {
    let markStat: () => void = () => {};
    // Background work from an earlier test must not write into this test's calls.
    const local: Calls = (calls = {
      logs: [],
      stats: [],
      lookups: [],
      confirmations: [],
      statRecorded: new Promise<void>(resolve => {
        markStat = resolve;
      }),
    });
    const User = {
      hashPassword:
        hashPassword || (async (password: string) => `$scrypt$${password}`),
      isValidPassword: (password: unknown) =>
        validPassword && typeof password === 'string' && password.length >= 8,
      findOne(query: unknown, projection: unknown) {
        local.lookups.push([query, projection]);
        return findOneError
          ? Promise.reject(findOneError)
          : Promise.resolve(user || null);
      },
      findById: () => Promise.resolve(user || null),
      findOneAndUpdate(
        query: Record<string, unknown>,
        update: PasswordUpdate,
        options: { new: boolean; runValidators: boolean },
      ) {
        if (findOneAndUpdateError) return Promise.reject(findOneAndUpdateError);
        if (user && findOneAndUpdateUser === user) {
          user.lastPasswordUpdate = { query, update, options };
        }
        return Promise.resolve(findOneAndUpdateUser);
      },
    };

    return (
      await mockModule<{ default: Controller }>(
        new URL(controllerPath, import.meta.url),
        {
          mongoose: { model: () => User },
          crypto: randomBytes ? { randomBytes } : importedDependency0,
          './users.profile.server.controller': {
            sanitizeOwnProfile: (profile: TestUser) => profile,
          },
          '../../../core/server/services/email.server.service': {
            sendResetPassword: (_profile: TestUser, cb: Callback) =>
              cb(resetEmailError),
            sendResetPasswordConfirm: (profile: unknown, cb: Callback) => {
              local.confirmations.push(profile);
              cb(confirmEmailError);
            },
          },
          '../../../stats/server/services/stats.server.service.mts': {
            stat: (payload: StatPayload, cb: Callback) => {
              local.stats.push(payload);
              markStat();
              cb();
            },
          },
          '@trustroots/logger': (...args: unknown[]) => {
            local.logs.push(args);
          },
        },
      )
    ).default;
  }

  async function run(
    controller: Controller,
    method: Method,
    request: PasswordRequest,
  ): Promise<MockResponse> {
    const res = deferredResponse();
    controller[method](request, res);
    return res.waitForResponse();
  }

  function fakeUser(overrides: Partial<TestUser> = {}): TestUser {
    return {
      displayName: 'Direct User',
      email: 'direct@example.test',
      password: 'oldpassword1',
      save: () => Promise.resolve(),
      authenticate: password => Promise.resolve(password === 'oldpassword1'),
      ...overrides,
    };
  }

  const passwords = {
    newPassword: 'newpassword123',
    verifyPassword: 'newpassword123',
  };
  const login =
    (error?: Error) =>
    (_user: TestUser, cb: Callback): void =>
      cb(error);
  const resetRequest = (loginError?: Error): PasswordRequest => ({
    params: { token: 'reset-token' },
    body: passwords,
    login: login(loginError),
  });
  const changeRequest = (loginError?: Error): PasswordRequest => ({
    user: { id: 'user-id' },
    body: { currentPassword: 'oldpassword1', ...passwords },
    login: login(loginError),
  });
  const tokenBytes = (length: number, cb: (e: null, b: Buffer) => void) =>
    cb(null, Buffer.from('token'));
  const updateOptions = { new: true, runValidators: true };

  describe('forgot', () => {
    for (const [label, body, status] of [
      ['a missing body', undefined, 400],
      ['an identifier at the length limit', { username: 'a'.repeat(320) }, 200],
    ] as const) {
      it(`answers ${status} for ${label}`, async () => {
        const res = await run(await loadController(), 'forgot', { body });
        res.statusCode.should.equal(status);
      });
    }

    it('acknowledges before token generation completes', async () => {
      let finishTokenGeneration!: (error: Error | null) => void;
      const controller = await loadController({
        randomBytes: (length, cb) => {
          finishTokenGeneration = cb;
        },
      });
      (
        await run(controller, 'forgot', {
          body: { username: 'person@example.test' },
        })
      ).statusCode.should.equal(200);
      await new Promise(resolve => setImmediate(resolve));
      finishTokenGeneration(new Error('private token error'));
      await calls.statRecorded;
      calls.lookups.should.deepEqual([]);
    });

    const forgotCases: Array<[string, LoadOptions, string, string?]> = [
      [
        'token generation fails',
        { randomBytes: (length, cb) => cb(new Error('private token error')) },
        'failed:tokenGeneration',
        'Password recovery token generation failed.',
      ],
      ['no account matches', {}, 'failed:noUser'],
      [
        'the account lookup fails',
        { findOneError: new Error('lookup') },
        'failed:lookup',
        'Password recovery account lookup failed.',
      ],
      [
        'saving the token fails',
        { user: fakeUser({ save: () => Promise.reject(new Error('save')) }) },
        'failed:tokenSave',
        'Password recovery token save failed.',
      ],
      [
        'the email cannot be delivered',
        { user: fakeUser(), resetEmailError: new Error('smtp') },
        'failed:emailDelivery',
        'Password recovery email delivery failed.',
      ],
      ['the email is sent', { user: fakeUser() }, 'emailSent'],
    ];
    for (const [label, options, status, logMessage] of forgotCases) {
      it(`reports ${status} when ${label}`, async () => {
        const controller = await loadController({
          randomBytes: tokenBytes,
          ...options,
        });
        const res = await run(controller, 'forgot', {
          body: { username: 'Person@Example.test' },
        });
        res.statusCode.should.equal(200);
        await calls.statRecorded;
        calls.stats.should.deepEqual([
          {
            namespace: 'passwordReset',
            counts: { count: 1 },
            tags: { status },
          },
        ]);
        calls.logs.should.deepEqual(logMessage ? [['error', logMessage]] : []);
        if (status !== 'failed:tokenGeneration') {
          const handle = 'person@example.test';
          calls.lookups.should.deepEqual([
            [
              { $or: [{ username: handle }, { email: handle }] },
              '-salt -password',
            ],
          ]);
        }
      });
    }
  });

  describe('reset', () => {
    for (const [emailFails, logoutFails] of [
      [false, false],
      [true, false],
      [false, true],
    ]) {
      it(`requires a fresh MFA sign-in after password recovery (email failure: ${emailFails}, logout failure: ${logoutFails})`, async () => {
        const user = fakeUser({ mfaEnabled: true });
        const controller = await loadController({
          user,
          confirmEmailError: emailFails
            ? new Error('email unavailable')
            : undefined,
        });
        const res = await run(controller, 'reset', {
          ...resetRequest(),
          login: () => {
            throw new Error('Recovery must not authenticate an MFA account');
          },
          logout: callback =>
            callback(logoutFails ? new Error('logout failed') : null),
        });
        res.statusCode.should.equal(logoutFails ? 400 : 200);
        res.body!.should.deepEqual(
          logoutFails
            ? { message: 'Password reset failed.' }
            : { mfaRequired: true },
        );
        calls.confirmations.should.deepEqual(
          logoutFails
            ? []
            : [{ displayName: user.displayName, email: user.email }],
        );
        calls.logs.should.deepEqual(
          emailFails
            ? [['error', 'Password reset confirmation email delivery failed.']]
            : [],
        );
      });
    }

    it('rejects a matching but invalid password without updating', async () => {
      const user = fakeUser();
      const res = await run(await loadController({ user }), 'reset', {
        ...resetRequest(),
        body: { newPassword: 'short', verifyPassword: 'short' },
      });
      res.statusCode.should.equal(400);
      res.body!.should.deepEqual({ message: 'Password reset failed.' });
      (user.lastPasswordUpdate === undefined).should.be.true();
    });

    it('returns the reset failure response when login fails after the atomic update', async () => {
      const user = fakeUser();
      const res = await run(
        await loadController({ user }),
        'reset',
        resetRequest(new Error('login failed')),
      );
      res.statusCode.should.equal(400);
      res.body!.should.deepEqual({ message: 'Password reset failed.' });
      calls.logs.should.deepEqual([
        ['error', 'Authenticating user after password reset failed.'],
      ]);
      const { update, options } = user.lastPasswordUpdate!;
      update.$set!.password!.should.match(/^\$scrypt\$/);
      update.$unset!.should.have.property('salt', 1);
      update.$inc!.should.deepEqual({ authVersion: 1 });
      options.should.deepEqual(updateOptions);
    });

    for (const confirmEmailError of [undefined, new Error('confirm failed')]) {
      it(`answers with the profile ${confirmEmailError ? 'and logs a failed' : 'after a'} confirmation email`, async () => {
        const user = fakeUser();
        const res = await run(
          await loadController({ user, confirmEmailError }),
          'reset',
          resetRequest(),
        );
        res.statusCode.should.equal(200);
        res.body!.should.equal(user);
        calls.confirmations.should.deepEqual([
          { displayName: 'Direct User', email: 'direct@example.test' },
        ]);
        calls.logs.should.deepEqual(
          confirmEmailError
            ? [['error', 'Password reset confirmation email delivery failed.']]
            : [],
        );
      });
    }

    for (const [method, request] of [
      ['reset', resetRequest()],
      ['changePassword', changeRequest()],
    ] as const) {
      for (const [error, status, logs] of [
        [
          Object.assign(new Error('busy'), {
            code: 'KDF_OVERLOADED',
            status: 503,
          }),
          503,
          [],
        ],
        [
          new Error('hash provider unavailable'),
          400,
          method === 'reset'
            ? [['error', 'Password reset credential generation failed.']]
            : [],
        ],
      ] as const) {
        it(`${method} answers ${status} when hashing fails with ${error.message}`, async () => {
          const controller = await loadController({
            user: fakeUser(),
            hashPassword: async () => {
              throw error;
            },
          });
          const res = await run(controller, method, request);
          res.statusCode.should.equal(status);
          res.body!.message!.should.equal(
            method === 'reset' ? 'Password reset failed.' : error.message,
          );
          calls.logs.should.deepEqual(logs);
        });
      }
    }

    it('uses the error status when the atomic update fails', async () => {
      const controller = await loadController({
        findOneAndUpdateError: Object.assign(new Error('busy'), {
          status: 503,
        }),
      });
      const res = await run(controller, 'reset', resetRequest());
      res.statusCode.should.equal(503);
      res.body!.message!.should.equal('Password reset failed.');
    });
  });

  describe('changePassword', () => {
    for (const verified of [true, false, undefined]) {
      it(`carries only the current MFA verification state across a password change (${verified})`, async () => {
        const controller = await loadController({
          user: fakeUser({ mfaEnabled: true, $locals: { mfaVerified: true } }),
        });
        const req = changeRequest();
        if (verified !== undefined)
          req.user!.$locals = { mfaVerified: verified };
        const res = await run(controller, 'changePassword', {
          ...req,
          login(user, callback) {
            should(user.$locals?.mfaVerified).equal(verified === true);
            callback();
          },
        });
        res.statusCode.should.equal(200);
      });
    }

    it('forbids an anonymous request', async () => {
      const res = await run(await loadController(), 'changePassword', {
        body: {},
      });
      res.statusCode.should.equal(403);
      res.body!.should.deepEqual({ message: 'Forbidden.' });
    });

    const failures: Array<[string, LoadOptions, PasswordRequest, string]> = [
      [
        'a password that fails validation',
        { validPassword: false },
        changeRequest(),
        'Password should be more than 8 characters long.',
      ],
      [
        'a stale password compare-and-set',
        { user: fakeUser(), findOneAndUpdateUser: null },
        changeRequest(),
        'Current password is incorrect.',
      ],
      [
        'a password update database error',
        {
          user: fakeUser(),
          findOneAndUpdateError: new Error('database unavailable'),
        },
        changeRequest(),
        'database unavailable',
      ],
      [
        'a failed reauthentication',
        { user: fakeUser() },
        changeRequest(new Error('login failed')),
        'login failed',
      ],
    ];
    for (const [label, options, request, message] of failures) {
      it(`rejects ${label}`, async () => {
        const res = await run(
          await loadController(options),
          'changePassword',
          request,
        );
        res.statusCode.should.equal(400);
        res.body!.message!.should.equal(message);
      });
    }

    const compareAndSet: Array<
      [Partial<TestUser>, Record<string, unknown>, Error | undefined]
    > = [
      [
        {},
        {
          salt: { $exists: false },
          $or: [{ authVersion: { $exists: false } }, { authVersion: 0 }],
        },
        undefined,
      ],
      [
        { authVersion: 0 },
        {
          salt: { $exists: false },
          $or: [{ authVersion: { $exists: false } }, { authVersion: 0 }],
        },
        new Error('confirm email failed'),
      ],
      [
        { salt: 'legacy-salt', authVersion: 3 },
        { salt: 'legacy-salt', authVersion: 3 },
        undefined,
      ],
    ];
    for (const [overrides, filter, confirmEmailError] of compareAndSet) {
      it(`guards the update with ${JSON.stringify(overrides)}${confirmEmailError ? ' and logs a failed confirmation' : ''}`, async () => {
        const user = fakeUser(overrides);
        const res = await run(
          await loadController({ user, confirmEmailError }),
          'changePassword',
          changeRequest(),
        );
        res.statusCode.should.equal(200);
        res.body!.message!.should.equal('Password changed successfully!');
        const { query, update, options } = user.lastPasswordUpdate!;
        query.should.deepEqual({
          _id: undefined,
          password: 'oldpassword1',
          ...filter,
        });
        options.should.deepEqual(updateOptions);
        update.$set!.password!.should.match(/^\$scrypt\$/);
        update.$unset!.should.deepEqual({ salt: 1 });
        update.$inc!.should.deepEqual({ authVersion: 1 });
        calls.logs.should.deepEqual(
          confirmEmailError
            ? [['error', 'Password change confirmation email delivery failed.']]
            : [],
        );
      });
    }
  });
});
