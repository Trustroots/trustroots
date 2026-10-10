require('should');

let createTargetedRequestLimits;
let getRequestIdentity;

function loadMiddleware(
  consume,
  getClientIpAddress = () => '198.51.100.20',
  policyOverrides = {},
) {
  const config = {
    targetedRequestLimits: {
      signin: { windowMs: 60_000, ipLimit: 10, identityLimit: 2 },
      forgotPassword: { windowMs: 60_000, ipLimit: 10, identityLimit: 2 },
      resetPassword: { windowMs: 60_000, ipLimit: 10, identityLimit: 2 },
      resendConfirmation: { windowMs: 60_000, ipLimit: 10, identityLimit: 2 },
      avatarUpload: { windowMs: 60_000, ipLimit: 10, identityLimit: 2 },
      mfaVerify: { windowMs: 60_000, ipLimit: 10, identityLimit: 2 },
    },
  };
  Object.entries(policyOverrides).forEach(([name, policy]) => {
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

function response() {
  const res = { statusCode: 200, headers: {}, body: null };
  res.set = (name, value) => {
    res.headers[name] = value;
    return res;
  };
  res.status = code => {
    res.statusCode = code;
    return res;
  };
  res.send = body => {
    res.body = body;
    return res;
  };
  return res;
}

describe('Targeted request limit middleware', function () {
  before(async function () {
    ({ createTargetedRequestLimits, getRequestIdentity } = await import(
      '../../server/middleware/targeted-request-limit.server.middleware.mjs'
    ));
  });

  it('combines trusted IP and normalised account identity', async function () {
    let options;
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
    options.operation.should.equal('signin');
    options.dimensions
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
    let options;
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
    options.dimensions.should.deepEqual([
      { name: 'member', value: 'fictional-member', limit: 2 },
    ]);
  });

  it('limits MFA attempts by account across different IP addresses', async function () {
    let options;
    const middleware = loadMiddleware(
      async value => {
        options = value;
        return { allowed: true };
      },
      () => '198.51.100.30',
    );
    await middleware.mfaVerify(
      { session: { mfaChallenge: { userId: 'fictional-member-id' } } },
      response(),
      () => {},
    );

    options.dimensions.should.deepEqual([
      {
        name: 'ip',
        value: '198.51.100.30',
        limit: 10,
      },
      {
        name: 'ip-and-identity',
        value: JSON.stringify(['198.51.100.30', 'fictional-member-id']),
        limit: 2,
      },
      {
        name: 'member',
        value: 'fictional-member-id',
        limit: 2,
      },
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
});
