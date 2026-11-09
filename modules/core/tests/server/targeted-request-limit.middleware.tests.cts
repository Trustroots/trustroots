require('should');

type Operation =
  | 'signup'
  | 'support'
  | 'signin'
  | 'forgotPassword'
  | 'resetPassword'
  | 'resendConfirmation'
  | 'avatarUpload';
type Policy = {
  enabled?: boolean;
  windowMs: number;
  ipLimit: number;
  identityLimit: number;
};
type Config = { targetedRequestLimits: Record<Operation, Policy> };
type Request = {
  ip?: string;
  user?: { id?: string };
  body?: { email?: unknown; username?: unknown };
  params?: { token?: unknown };
  get?: (name: string) => string | undefined;
};
type Dimension = { name: string; value: string; limit: number };
type ConsumeOptions = {
  operation: Operation;
  dimensions: Dimension[];
  windowMs: number;
};
type Response = {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  set(name: string, value: string): Response;
  status(code: number): Response;
  send(body: unknown): Response;
};
type Next = () => void;
type Middleware = (req: Request, res: Response, next: Next) => Promise<unknown>;
type MiddlewareSet = Record<Operation, Middleware> & {
  getRequestIdentity(req: Request, source: string): string | undefined;
};
type MiddlewareFactory = (dependencies: {
  config: Config;
  getClientIpAddress: (req: Request) => string | undefined;
  consume: (
    options: ConsumeOptions,
  ) => Promise<{ allowed: boolean; retryAfterSeconds?: number }>;
}) => MiddlewareSet;
type IdentityGetter = MiddlewareSet['getRequestIdentity'];

let createTargetedRequestLimits: MiddlewareFactory;
let getRequestIdentity: IdentityGetter;

function loadMiddleware(
  consume: (
    options: ConsumeOptions,
  ) => Promise<{ allowed: boolean; retryAfterSeconds?: number }>,
  getClientIpAddress: (req: Request) => string | undefined = () =>
    '198.51.100.20',
  policyOverrides: Partial<Record<Operation, Partial<Policy> | null>> = {},
): MiddlewareSet {
  const config: Config = {
    targetedRequestLimits: {
      signup: { windowMs: 60_000, ipLimit: 10, identityLimit: 2 },
      support: { windowMs: 60_000, ipLimit: 10, identityLimit: 2 },
      signin: { windowMs: 60_000, ipLimit: 10, identityLimit: 2 },
      forgotPassword: { windowMs: 60_000, ipLimit: 10, identityLimit: 2 },
      resetPassword: { windowMs: 60_000, ipLimit: 10, identityLimit: 2 },
      resendConfirmation: { windowMs: 60_000, ipLimit: 10, identityLimit: 2 },
      avatarUpload: { windowMs: 60_000, ipLimit: 10, identityLimit: 2 },
    },
  };
  (
    Object.entries(policyOverrides) as [Operation, Partial<Policy> | null][]
  ).forEach(([name, policy]) => {
    if (policy === null) {
      delete config.targetedRequestLimits[name];
    } else {
      Object.assign(config.targetedRequestLimits[name], policy);
    }
  });
  return createTargetedRequestLimits({
    config,
    getClientIpAddress,
    consume,
  });
}

function response(): Response {
  const res: Response = {
    statusCode: 200,
    headers: {},
    body: null,
    set(name, value) {
      res.headers[name] = value;
      return res;
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

describe('Targeted request limit middleware', function () {
  before(async function () {
    ({ createTargetedRequestLimits, getRequestIdentity } =
      await import('../../server/middleware/targeted-request-limit.server.middleware.mjs'));
  });

  it('counts signup by normalised recipient independently of client address', async function () {
    const calls: ConsumeOptions[] = [];
    const middleware = loadMiddleware(
      async options => {
        calls.push(options);
        return { allowed: true };
      },
      req => req.ip,
    );
    for (const ip of ['198.51.100.21', '198.51.100.22']) {
      await middleware.signup(
        { ip, body: { email: ' Fictional@Example.org ' } },
        response(),
        () => {},
      );
    }
    calls[0].operation.should.equal('signup');
    for (const call of calls) {
      call.dimensions[2].should.deepEqual({
        name: 'recipient',
        value: 'fictional@example.org',
        limit: 2,
      });
    }
    calls[0].dimensions[0].value.should.not.equal(calls[1].dimensions[0].value);
  });

  it('limits anonymous support by client address and signed-in support by member', async function () {
    const calls: ConsumeOptions[] = [];
    const middleware = loadMiddleware(async options => {
      calls.push(options);
      return { allowed: true };
    });
    await middleware.support({}, response(), () => {});
    await middleware.support(
      { user: { id: 'fictional-member' } },
      response(),
      () => {},
    );
    calls[0].operation.should.equal('support');
    calls[0].dimensions
      .map(dimension => dimension.name)
      .should.deepEqual(['ip']);
    calls[1].dimensions
      .map(dimension => dimension.name)
      .should.deepEqual(['ip', 'ip-and-identity', 'member']);
  });

  it('ignores missing and non-string signup recipients', function () {
    const assert = require('assert/strict');
    assert.equal(getRequestIdentity({}, 'recipient'), undefined);
    assert.equal(
      getRequestIdentity({ body: { email: null } }, 'recipient'),
      undefined,
    );
  });

  it('combines trusted IP and normalised account identity', async function () {
    let options: ConsumeOptions | undefined;
    const middleware = loadMiddleware(async value => {
      options = value;
      return { allowed: true, retryAfterSeconds: 3 };
    });
    let proceeded = false;
    await middleware.signin(
      {
        body: { username: ' Sample.Member ' },
        get: () => 'forged',
        ip: '192.0.2.1',
      },
      response(),
      () => {
        proceeded = true;
      },
    );

    proceeded.should.be.true();
    options!.operation.should.equal('signin');
    options!.dimensions
      .map(value => value.value)
      .should.deepEqual([
        '198.51.100.20',
        JSON.stringify(['198.51.100.20', 'sample.member']),
      ]);
  });

  it('rejects limited requests with Retry-After', async function () {
    const middleware = loadMiddleware(async () => ({
      allowed: false,
      retryAfterSeconds: 17,
    }));
    const res = response();
    await middleware.forgotPassword(
      { body: { username: 'member' }, get: () => undefined, ip: '192.0.2.1' },
      res,
      () => {
        throw new Error('should not proceed');
      },
    );
    res.statusCode.should.equal(429);
    res.headers['Retry-After'].should.equal('17');
  });

  it('fails closed when the client address is unavailable', async function () {
    const middleware = loadMiddleware(
      async () => ({ allowed: true, retryAfterSeconds: 1 }),
      () => undefined,
    );
    const res = response();
    await middleware.signin(
      { body: { username: 'member' }, get: () => undefined, ip: undefined },
      res,
      () => {
        throw new Error('should not proceed');
      },
    );
    res.statusCode.should.equal(503);
  });

  it('fails closed when counter storage throws', async function () {
    const middleware = loadMiddleware(async () => {
      throw new Error('mongo down');
    });
    const res = response();
    await middleware.resetPassword(
      {
        params: { token: 'token-value' },
        get: () => undefined,
        ip: '192.0.2.1',
      },
      res,
      () => {
        throw new Error('should not proceed');
      },
    );
    res.statusCode.should.equal(503);
  });

  it('skips limiting when a policy is disabled', async function () {
    const middleware = loadMiddleware(
      async () => {
        throw new Error('should not consume');
      },
      () => '198.51.100.20',
      { signin: { enabled: false } },
    );
    let proceeded = false;
    await middleware.signin(
      { body: { username: 'member' }, get: () => undefined, ip: '192.0.2.1' },
      response(),
      () => {
        proceeded = true;
      },
    );
    proceeded.should.be.true();
  });

  it('ignores missing and malformed request identities', function () {
    const assert = require('assert/strict');
    assert.equal(getRequestIdentity({}, 'account'), undefined);
    assert.equal(
      getRequestIdentity({ body: { username: 123 } }, 'account'),
      undefined,
    );
    assert.equal(getRequestIdentity({}, 'token'), undefined);
    assert.equal(
      getRequestIdentity({ params: { token: 123 } }, 'token'),
      undefined,
    );
    assert.equal(
      getRequestIdentity({ params: { token: 'Token-Value' } }, 'unknown'),
      undefined,
    );
  });

  it('fails closed when the policy window is invalid', async function () {
    const middleware = loadMiddleware(
      async () => {
        throw new Error('should not consume');
      },
      () => '198.51.100.20',
      { signin: { windowMs: 0 } },
    );
    const res = response();
    await middleware.signin({ body: { username: 'member' } }, res, () => {
      throw new Error('should not proceed');
    });
    res.statusCode.should.equal(503);
  });

  it('limits member actions without an IP dimension when IP limiting is disabled', async function () {
    let options: ConsumeOptions | undefined;
    const middleware = loadMiddleware(
      async value => {
        options = value;
        return { allowed: true };
      },
      () => undefined,
      { avatarUpload: { ipLimit: 0 } },
    );
    await middleware.avatarUpload(
      { user: { id: 'fictional-member' } },
      response(),
      () => {},
    );
    options!.dimensions.should.deepEqual([
      { name: 'member', value: 'fictional-member', limit: 2 },
    ]);
  });

  it('skips storage when no configured dimension has an identity', async function () {
    const middleware = loadMiddleware(
      async () => {
        throw new Error('should not consume');
      },
      () => undefined,
      { signin: { ipLimit: 0 } },
    );
    let proceeded = false;
    await middleware.signin({}, response(), () => {
      proceeded = true;
    });
    proceeded.should.be.true();
  });

  const unavailable = {
    message: 'This service is temporarily unavailable. Please try again later.',
  };

  function recordCalls() {
    const calls: ConsumeOptions[] = [];
    const consume = async (options: ConsumeOptions) => {
      calls.push(options);
      return { allowed: true };
    };
    return { calls, consume };
  }

  it('uses the reset token from the route as the identity', async function () {
    const assert = require('assert/strict');
    assert.equal(
      getRequestIdentity({ params: { token: 'Token-Value' } }, 'token'),
      'Token-Value',
    );
    const { calls, consume } = recordCalls();
    await loadMiddleware(consume).resetPassword(
      { params: { token: 'Token-Value' } },
      response(),
      () => {},
    );
    assert.deepEqual(calls, [
      {
        operation: 'resetPassword',
        windowMs: 60_000,
        dimensions: [
          { name: 'ip', value: '198.51.100.20', limit: 10 },
          {
            name: 'ip-and-identity',
            value: JSON.stringify(['198.51.100.20', 'Token-Value']),
            limit: 2,
          },
        ],
      },
    ]);
  });

  it('names each operation and limits confirmation resends per member', async function () {
    const assert = require('assert/strict');
    const { calls, consume } = recordCalls();
    const middleware = loadMiddleware(consume);
    await middleware.forgotPassword(
      { body: { username: 'Member' } },
      response(),
      () => {},
    );
    await middleware.resendConfirmation(
      { user: { id: 'fictional-member' } },
      response(),
      () => {},
    );
    assert.deepEqual(
      calls.map(call => call.operation),
      ['forgotPassword', 'resendConfirmation'],
    );
    assert.deepEqual(calls[0].dimensions[1], {
      name: 'ip-and-identity',
      value: JSON.stringify(['198.51.100.20', 'member']),
      limit: 2,
    });
    assert.deepEqual(calls[1].dimensions, [
      { name: 'ip', value: '198.51.100.20', limit: 10 },
      {
        name: 'ip-and-identity',
        value: JSON.stringify(['198.51.100.20', 'fictional-member']),
        limit: 2,
      },
      { name: 'member', value: 'fictional-member', limit: 2 },
    ]);
  });

  for (const windowMs of [0, -1, 1.5]) {
    it(`fails closed without counting for a policy window of ${windowMs}`, async function () {
      const assert = require('assert/strict');
      const { calls, consume } = recordCalls();
      const middleware = loadMiddleware(consume, () => '198.51.100.20', {
        signin: { windowMs },
      });
      const res = response();
      let proceeded = false;
      await middleware.signin({ body: { username: 'member' } }, res, () => {
        proceeded = true;
      });
      assert.equal(proceeded, false);
      assert.equal(res.statusCode, 503);
      assert.deepEqual(res.body, unavailable);
      assert.deepEqual(calls, []);
    });
  }

  it('explains why limited, address-less and storage-failed requests are refused', async function () {
    const assert = require('assert/strict');
    const limited = response();
    await loadMiddleware(async () => ({
      allowed: false,
      retryAfterSeconds: 5,
    })).signin({ body: { username: 'member' } }, limited, () => {});
    assert.deepEqual(limited.body, {
      message: 'Too many requests. Please try again later.',
    });

    const withoutAddress = response();
    await loadMiddleware(
      async () => ({ allowed: true }),
      () => undefined,
    ).signin({ body: { username: 'member' } }, withoutAddress, () => {});
    assert.deepEqual(withoutAddress.body, unavailable);

    const storageDown = response();
    await loadMiddleware(async () => {
      throw new Error('mongo down');
    }).signin({ body: { username: 'member' } }, storageDown, () => {});
    assert.deepEqual(storageDown.body, unavailable);
  });

  it('leaves out identity dimensions when identity limiting is disabled', async function () {
    const assert = require('assert/strict');
    const { calls, consume } = recordCalls();
    await loadMiddleware(consume, () => '198.51.100.20', {
      support: { identityLimit: 0 },
    }).support({ user: { id: 'fictional-member' } }, response(), () => {});
    assert.deepEqual(calls[0].dimensions, [
      { name: 'ip', value: '198.51.100.20', limit: 10 },
    ]);
  });

  it('leaves out the IP dimension when IP limiting is disabled even with an address', async function () {
    const assert = require('assert/strict');
    const { calls, consume } = recordCalls();
    await loadMiddleware(consume, () => '198.51.100.20', {
      support: { ipLimit: 0 },
    }).support({ user: { id: 'fictional-member' } }, response(), () => {});
    assert.deepEqual(
      calls[0].dimensions.map(dimension => dimension.name),
      ['ip-and-identity', 'member'],
    );
  });

  it('counts requests in the request limit store by default', async function () {
    const assert = require('assert/strict');
    const mongoose: typeof import('mongoose') = require('mongoose');
    require('../../server/models/request-limit.server.model.mjs');
    const RequestLimit = mongoose.model('RequestLimit');
    await RequestLimit.deleteMany({});
    try {
      const middleware = createTargetedRequestLimits({
        config: {
          targetedRequestLimits: {
            signin: { windowMs: 60_000, ipLimit: 1, identityLimit: 0 },
          },
        },
        getClientIpAddress: () => '198.51.100.30',
      } as unknown as Parameters<MiddlewareFactory>[0]);
      let proceeded = 0;
      const first = response();
      await middleware.signin({}, first, () => {
        proceeded++;
      });
      const second = response();
      await middleware.signin({}, second, () => {
        proceeded++;
      });
      assert.equal(proceeded, 1);
      assert.equal(second.statusCode, 429);
      assert.equal(await RequestLimit.countDocuments({}), 1);
    } finally {
      await RequestLimit.deleteMany({});
    }
  });
});
