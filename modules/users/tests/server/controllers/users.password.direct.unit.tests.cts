const mockModule: typeof import('../../../../../testutils/server/mock-module.mts').default = require('../../../../../testutils/server/mock-module');
require('should');

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
  body: PasswordBody;
  params?: { token: string };
  query?: { utm_source?: string; utm_medium?: string; utm_campaign?: string };
  user?: { id: string };
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
  resetPasswordToken?: string;
  resetPasswordExpires?: number;
  salt?: string;
  authVersion?: number;
  lastPasswordUpdate: {
    query: Record<string, unknown>;
    update: PasswordUpdate;
    options?: { new?: boolean; runValidators?: boolean };
  };
  save(callback: Callback): void;
  authenticate(password: string): Promise<boolean>;
}
interface Controller {
  forgot(request: PasswordRequest, response: MockResponse): void;
  validateResetToken(request: PasswordRequest, response: MockResponse): void;
  reset(request: PasswordRequest, response: MockResponse): Promise<void>;
  changePassword(request: PasswordRequest, response: MockResponse): void;
}
interface UserModel {
  hashPassword(password: string): Promise<string>;
  isValidPassword(password: unknown): boolean;
  findOne(
    query: Record<string, unknown>,
    projectionOrCallback:
      string | ((error: Error | null, user: TestUser | null) => void),
    callback?: (error: Error | null, user: TestUser | null) => void,
  ): void;
  findById(
    id: string,
    projectionOrCallback?:
      string | ((error: Error | null, user: TestUser | null) => void),
    callback?: (error: Error | null, user: TestUser | null) => void,
  ): Promise<TestUser | null> | undefined;
  findOneAndUpdate(
    query: Record<string, unknown>,
    update: PasswordUpdate,
    options: { new: boolean; runValidators: boolean },
    callback?: (error: Error | null, user: TestUser | null) => void,
  ): Promise<TestUser | null> | undefined;
}
interface LoadOptions {
  user?: TestUser;
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
  onStat?: (payload: StatPayload) => void;
}
interface StatPayload {
  tags: { status: string };
}
interface PasswordDependencies {
  mongoose: { model(name: string): UserModel };
  crypto: {
    randomBytes(
      length: number,
      callback: (error: Error | null, buffer?: Buffer) => void,
    ): void;
  };
  './users.profile.server.controller': {
    sanitizeProfile(profile: TestUser): TestUser;
    sanitizeOwnProfile(profile: TestUser): TestUser;
  };
  '../../../core/server/controllers/analytics.server.controller': {
    appendUTMParams(
      url: string,
      params: { source: string; medium: string; campaign: string },
    ): string;
  };
  '../../../core/server/services/email.server.service': {
    sendResetPassword(profile: TestUser, callback: Callback): void;
    sendResetPasswordConfirm(
      profile: Pick<TestUser, 'displayName' | 'email'>,
      callback: Callback,
    ): void;
  };
  '../../../stats/server/services/stats.server.service.mts': {
    stat(payload: StatPayload, callback: Callback): void;
  };
  '../../../../config/lib/logger': (...args: unknown[]) => void;
}

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
    json(body) {
      res.body = body;
      resolveResponse(res);
      return res;
    },
    redirect(url) {
      res.body = { message: url };
      resolveResponse(res);
      return res;
    },
    waitForResponse() {
      return promise;
    },
  };
  return res;
}

function loadController({
  user,
  confirmEmailError,
  hashPassword,
  findOneError,
  findOneAndUpdateError,
  findOneAndUpdateUser = user || null,
  validPassword = true,
  randomBytes,
  onStat = () => {},
}: LoadOptions = {}): Controller {
  const User: UserModel = {
    hashPassword: hashPassword || (async password => `$scrypt$${password}`),
    isValidPassword: password =>
      validPassword && typeof password === 'string' && password.length >= 8,
    findOne(query, projectionOrCallback, callback) {
      const cb =
        typeof callback === 'function'
          ? callback
          : typeof projectionOrCallback === 'function'
            ? projectionOrCallback
            : null;
      if (cb) {
        cb(findOneError || null, user || null);
        return undefined;
      }
      return findOneError
        ? Promise.reject(findOneError)
        : Promise.resolve(user || null);
    },
    findById(id, projectionOrCallback, callback) {
      const cb =
        typeof callback === 'function'
          ? callback
          : typeof projectionOrCallback === 'function'
            ? projectionOrCallback
            : null;
      if (cb) {
        cb(null, user || null);
        return undefined;
      }
      return Promise.resolve(user || null);
    },
    findOneAndUpdate(query, update, options, cb) {
      const error = findOneAndUpdateError || null;
      if (!error && user && findOneAndUpdateUser === user) {
        user.lastPasswordUpdate = { query, update, options };
        Object.assign(user, update.$set || {});
        if (update.$unset) {
          Object.keys(update.$unset).forEach(key => delete user[key]);
        }
        if (update.$inc && update.$inc.authVersion) {
          user.authVersion = (user.authVersion || 0) + update.$inc.authVersion;
        }
      }
      if (cb) {
        cb(error, findOneAndUpdateUser);
        return undefined;
      }
      return error
        ? Promise.reject(error)
        : Promise.resolve(findOneAndUpdateUser);
    },
  };

  const dependencies = {
    mongoose: {
      model: () => User,
    },
    crypto: randomBytes ? { randomBytes } : require('crypto'),
    './users.profile.server.controller': {
      sanitizeProfile: profile => profile,
      sanitizeOwnProfile: profile => profile,
    },
    '../../../core/server/controllers/analytics.server.controller': {
      appendUTMParams: url => url,
    },
    '../../../core/server/services/email.server.service': {
      sendResetPassword: (profile, cb) => cb(),
      sendResetPasswordConfirm: (profile, cb) => cb(confirmEmailError),
    },
    '../../../stats/server/services/stats.server.service.mts': {
      stat: (payload, cb) => {
        onStat(payload);
        cb();
      },
    },
    '../../../../config/lib/logger': () => {},
  } satisfies PasswordDependencies & Record<string, unknown>;
  return mockModule<Controller>(
    require.resolve('../../../server/controllers/users.password.server.controller.mts'),
    dependencies,
  );
}

function responseMessage(response: MockResponse): string {
  const message = response.body?.message;
  if (typeof message !== 'string')
    throw new Error('expected a response message');
  return message;
}

function fakeUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    displayName: 'Direct User',
    email: 'direct@example.test',
    password: 'oldpassword1',
    resetPasswordToken: 'reset-token',
    resetPasswordExpires: Date.now() + 3600000,
    lastPasswordUpdate: { query: {}, update: {} },
    save(cb) {
      cb();
    },
    authenticate(password) {
      return Promise.resolve(password === 'oldpassword1');
    },
    ...overrides,
  };
}

function passwordUpdate(user: TestUser): {
  password: string;
  unset: Record<string, 1>;
  authVersionIncrement: number;
} {
  const update = user.lastPasswordUpdate.update;
  const password = update.$set?.password;
  const unset = update.$unset;
  const authVersionIncrement = update.$inc?.authVersion;
  if (!password || !unset || authVersionIncrement === undefined) {
    throw new Error('expected a captured password update');
  }
  return { password, unset, authVersionIncrement };
}

function queryValue(user: TestUser, key: string): string | number | undefined {
  const value = user.lastPasswordUpdate.query[key];
  if (typeof value === 'string' || typeof value === 'number') return value;
  return undefined;
}

describe('Password controller direct unit tests', () => {
  describe('forgot', () => {
    it('acknowledges before token generation completes and logs token failures safely', async () => {
      let finishTokenGeneration!: (
        error: Error | null,
        buffer?: Buffer,
      ) => void;
      const controller = loadController({
        randomBytes: (length, cb) => {
          finishTokenGeneration = cb;
        },
      });
      const res = deferredResponse();

      controller.forgot({ body: { username: 'person@example.test' } }, res);
      (await res.waitForResponse()).statusCode.should.equal(200);
      await new Promise(resolve => setImmediate(resolve));
      finishTokenGeneration(new Error('private token error'));
    });

    it('handles account lookup and token persistence failures in the background', async () => {
      const completed: string[] = [];
      let completeStats: () => void = () => {};
      const statsComplete = new Promise<void>(resolve => {
        completeStats = resolve;
      });
      const makeController = (options: LoadOptions) =>
        loadController({
          ...options,
          randomBytes: (length, cb) => cb(null, Buffer.from('token')),
          onStat: payload => {
            completed.push(payload.tags.status);
            if (completed.length === 2) completeStats();
          },
        });
      const lookupController = makeController({
        findOneError: new Error('lookup'),
      });
      const lookupResponse = deferredResponse();
      lookupController.forgot(
        { body: { username: 'person@example.test' } },
        lookupResponse,
      );
      (await lookupResponse.waitForResponse()).statusCode.should.equal(200);

      const saveFailure = fakeUser({
        save: () => Promise.reject(new Error('save')),
      });
      const saveController = makeController({ user: saveFailure });
      const saveResponse = deferredResponse();
      saveController.forgot(
        { body: { username: 'person@example.test' } },
        saveResponse,
      );
      (await saveResponse.waitForResponse()).statusCode.should.equal(200);

      await statsComplete;
      completed.should.containEql('failed:lookup');
      completed.should.containEql('failed:tokenSave');
    });
  });

  describe('reset', () => {
    it('returns the reset failure response when login fails after the atomic update', async () => {
      const user = fakeUser();
      const controller = loadController({ user });
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
      responseMessage(res).should.equal('Password reset failed.');
      const update = passwordUpdate(user);
      update.password.should.match(/^\$scrypt\$/);
      update.unset.should.have.property('salt', 1);
      update.authVersionIncrement.should.equal(1);
    });

    it('returns retryable service unavailable when hashing is overloaded', async () => {
      const error: Error & { code?: string; status?: number } = new Error(
        'busy',
      );
      error.code = 'KDF_OVERLOADED';
      error.status = 503;
      const controller = loadController({
        user: fakeUser(),
        hashPassword: async () => {
          throw error;
        },
      });
      const res = deferredResponse();
      controller.reset(
        {
          params: { token: 'reset-token' },
          body: {
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (authenticatedUser, cb) => cb(),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(503);
    });

    it('returns a controlled failure when the hash provider fails', async () => {
      const controller = loadController({
        hashPassword: async () => {
          throw new Error('hash provider unavailable');
        },
      });
      const res = deferredResponse();

      controller.reset(
        {
          params: { token: 'reset-token' },
          body: {
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
        },
        res,
      );

      await res.waitForResponse();
      res.statusCode.should.equal(400);
      responseMessage(res).should.equal('Password reset failed.');
    });

    it('uses a service unavailable response when password hashing is overloaded', async () => {
      const controller = loadController({
        findOneAndUpdateError: Object.assign(new Error('busy'), {
          status: 503,
        }),
      });
      const res = deferredResponse();

      controller.reset(
        {
          params: { token: 'reset-token' },
          body: {
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
        },
        res,
      );

      await res.waitForResponse();
      res.statusCode.should.equal(503);
      responseMessage(res).should.equal('Password reset failed.');
    });
  });

  describe('changePassword', () => {
    it('rejects a password that fails validation', async () => {
      const controller = loadController({ validPassword: false });
      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: 'user-id' },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (authenticatedUser, callback) => callback(),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      responseMessage(res).should.equal(
        'Password should be more than 8 characters long.',
      );
    });

    it('reports a controlled error when the hash provider fails', async () => {
      const controller = loadController({
        user: fakeUser(),
        hashPassword: async () => {
          throw new Error('hash provider unavailable');
        },
      });
      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: 'user-id' },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      responseMessage(res).should.equal('hash provider unavailable');
    });

    it('rejects a stale password compare-and-set', async () => {
      const controller = loadController({
        user: fakeUser(),
        findOneAndUpdateUser: null,
      });
      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: 'user-id' },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      responseMessage(res).should.equal('Current password is incorrect.');
    });

    it('includes a legacy salt and non-zero auth version in its compare-and-set', async () => {
      const user = fakeUser({ salt: 'legacy-salt', authVersion: 3 });
      const controller = loadController({ user });
      const res = deferredResponse();

      controller.changePassword(
        {
          user: { id: 'user-id' },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (authenticatedUser, callback) => callback(),
        },
        res,
      );

      await res.waitForResponse();
      res.statusCode.should.equal(200);
      queryValue(user, 'salt')!.should.equal('legacy-salt');
      queryValue(user, 'authVersion')!.should.equal(3);
    });

    it('reports a password update database error', async () => {
      const controller = loadController({
        user: fakeUser(),
        findOneAndUpdateError: new Error('database unavailable'),
      });
      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: 'user-id' },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      responseMessage(res).should.equal('database unavailable');
    });
    it('returns the login failure when reauthentication fails', async () => {
      const controller = loadController({ user: fakeUser() });
      const res = deferredResponse();

      controller.changePassword(
        {
          user: { id: 'user-id' },
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
      responseMessage(res).should.equal('login failed');
    });

    it('returns the confirmation email failure after saving and logging in', async () => {
      const user = fakeUser();
      const controller = loadController({
        user,
        confirmEmailError: new Error('confirm email failed'),
      });
      const res = deferredResponse();

      controller.changePassword(
        {
          user: { id: 'user-id' },
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
      responseMessage(res).should.equal('Password changed successfully!');
      const update = passwordUpdate(user);
      update.password.should.match(/^\$scrypt\$/);
      update.unset.should.have.property('salt', 1);
      update.authVersionIncrement.should.equal(1);
    });

    it('returns retryable service unavailable when password hashing is overloaded', async () => {
      const error: Error & { code?: string; status?: number } = new Error(
        'busy',
      );
      error.code = 'KDF_OVERLOADED';
      error.status = 503;
      const controller = loadController({
        user: fakeUser(),
        hashPassword: async () => {
          throw error;
        },
      });
      const res = deferredResponse();

      controller.changePassword(
        {
          user: { id: 'user-id' },
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
      res.statusCode.should.equal(503);
    });
  });
});
