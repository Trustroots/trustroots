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
    assert.equal(getRequestIdentity({}, 'unknown'), undefined);
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
});
