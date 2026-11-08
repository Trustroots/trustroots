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
  body?: PasswordBody;
  params?: { token: string };
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
  salt?: string;
  authVersion?: number;
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
  const respond = (body: ResponseBody) => {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  const res: MockResponse = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    send: respond,
    json: respond,
    redirect: url => respond({ message: url }),
    waitForResponse: () => promise,
  };
  return res;
}

function loadController({
  user,
  resetEmailError,
  confirmEmailError,
  hashPassword,
  findOneError,
  findOneAndUpdateError,
  findOneAndUpdateUser = user || null,
  validPassword = true,
  randomBytes,
}: LoadOptions = {}): Controller {
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

  return mockModule<Controller>(
    require.resolve('../../../server/controllers/users.password.server.controller.mts'),
    {
      mongoose: { model: () => User },
      crypto: randomBytes ? { randomBytes } : require('crypto'),
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
      '../../../../config/lib/logger': (...args: unknown[]) => {
        local.logs.push(args);
      },
    },
  );
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

describe('Password controller direct unit tests', () => {
  describe('forgot', () => {
    for (const [label, body, status] of [
      ['a missing body', undefined, 400],
      ['an identifier at the length limit', { username: 'a'.repeat(320) }, 200],
    ] as const) {
      it(`answers ${status} for ${label}`, async () => {
        const res = await run(loadController(), 'forgot', { body });
        res.statusCode.should.equal(status);
      });
    }

    it('acknowledges before token generation completes', async () => {
      let finishTokenGeneration!: (error: Error | null) => void;
      const controller = loadController({
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
        const controller = loadController({
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
    it('rejects a matching but invalid password without updating', async () => {
      const user = fakeUser();
      const res = await run(loadController({ user }), 'reset', {
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
        loadController({ user }),
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
          loadController({ user, confirmEmailError }),
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
          const controller = loadController({
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
      const controller = loadController({
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
    it('forbids an anonymous request', async () => {
      const res = await run(loadController(), 'changePassword', { body: {} });
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
          loadController(options),
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
          loadController({ user, confirmEmailError }),
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
