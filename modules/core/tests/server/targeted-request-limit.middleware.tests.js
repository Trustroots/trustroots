const proxyquire = require('proxyquire').noCallThru();
require('should');

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
    },
  };
  Object.entries(policyOverrides).forEach(([name, policy]) => {
    if (policy === null) {
      delete config.targetedRequestLimits[name];
    } else {
      Object.assign(config.targetedRequestLimits[name], policy);
    }
  });
  return proxyquire(
    '../../server/middleware/targeted-request-limit.server.middleware',
    {
      '../../../../config/config': config,
      '../services/client-ip.server.service': { getClientIpAddress },
      '../services/targeted-request-limits.server.service': { consume },
    },
  );
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

  it('returns 429 with Retry-After for an exceeded policy', async function () {
    const middleware = loadMiddleware(async () => ({
      allowed: false,
      retryAfterSeconds: 42,
    }));
    const res = response();
    await middleware.forgotPassword(
      { body: { username: 'sample' } },
      res,
      () => {},
    );

    res.statusCode.should.equal(429);
    res.headers['Retry-After'].should.equal('42');
  });

  it('skips missing and disabled policies', async function () {
    const middleware = loadMiddleware(
      async () => {
        throw new Error('disabled limits must not access storage');
      },
      undefined,
      { signin: null, forgotPassword: { enabled: false } },
    );
    let proceeded = 0;
    await middleware.signin({}, response(), () => {
      proceeded += 1;
    });
    await middleware.forgotPassword({}, response(), () => {
      proceeded += 1;
    });
    proceeded.should.equal(2);
  });

  it('fails closed without an IP or when shared storage is unavailable', async function () {
    const missingIp = loadMiddleware(
      async () => ({ allowed: true }),
      () => undefined,
    );
    const missingIpResponse = response();
    await missingIp.signin(
      { body: { username: 'sample' } },
      missingIpResponse,
      () => {},
    );
    missingIpResponse.statusCode.should.equal(503);

    const failedStore = loadMiddleware(async () => {
      throw new Error('private database detail');
    });
    const failedStoreResponse = response();
    await failedStore.signin(
      { body: { username: 'sample' } },
      failedStoreResponse,
      () => {},
    );
    failedStoreResponse.statusCode.should.equal(503);
    JSON.stringify(failedStoreResponse.body).should.not.containEql(
      'private database detail',
    );
  });

  it('limits authenticated member operations by member identity', async function () {
    let options;
    const middleware = loadMiddleware(async value => {
      options = value;
      return { allowed: true, retryAfterSeconds: 1 };
    });
    await middleware.avatarUpload(
      { user: { id: 'member-id' } },
      response(),
      () => {},
    );

    options.operation.should.equal('avatarUpload');
    options.dimensions
      .map(value => value.name)
      .should.deepEqual(['ip', 'ip-and-identity', 'member']);
    options.dimensions[2].value.should.equal('member-id');
  });

  it('uses a password-reset token as an identity and tolerates a missing user', async function () {
    let options;
    const middleware = loadMiddleware(async value => {
      options = value;
      return { allowed: true, retryAfterSeconds: 1 };
    });
    await middleware.resetPassword(
      { params: { token: 'anonymous-reset-token' } },
      response(),
      () => {},
    );
    options.operation.should.equal('resetPassword');
    options.dimensions[1].value.should.equal(
      JSON.stringify(['198.51.100.20', 'anonymous-reset-token']),
    );

    await middleware.avatarUpload({}, response(), () => {});
    options.dimensions.map(value => value.name).should.deepEqual(['ip']);
  });

  it('returns no identity for unsupported or malformed input values', function () {
    const middleware = loadMiddleware(async () => ({ allowed: true }));
    (
      middleware.getRequestIdentity({ body: { username: 123 } }, 'account') ===
      undefined
    ).should.be.true();
    (
      middleware.getRequestIdentity({ params: { token: 123 } }, 'token') ===
      undefined
    ).should.be.true();
    (
      middleware.getRequestIdentity({}, 'unknown') === undefined
    ).should.be.true();
  });

  it('skips disabled dimensions and rejects an invalid window', async function () {
    const middleware = loadMiddleware(
      async () => {
        throw new Error('disabled limits must not access storage');
      },
      undefined,
      { signin: { ipLimit: 0, identityLimit: 0 } },
    );
    let proceeded = false;
    await middleware.signin(
      { body: { username: 'sample' } },
      response(),
      () => {
        proceeded = true;
      },
    );
    proceeded.should.be.true();

    const invalidWindow = loadMiddleware(
      async () => ({ allowed: true }),
      undefined,
      { signin: { windowMs: 0 } },
    );
    const res = response();
    await invalidWindow.signin({ body: { username: 'sample' } }, res, () => {});
    res.statusCode.should.equal(503);
  });
});
