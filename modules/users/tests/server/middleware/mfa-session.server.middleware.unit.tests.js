require('./../../../server/models/user.server.model.mjs');
const {
  createMfaSessionMiddleware,
} = require('./../../../server/middleware/mfa-session.server.middleware.mjs');

function invoke(middleware, { user, path, method = 'GET' }) {
  let nextCalled = false;
  const res = {
    statusCode: null,
    body: null,
    redirectUrl: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    redirect(url) {
      this.redirectUrl = url;
      return this;
    },
  };
  middleware({ user, path, method }, res, () => {
    nextCalled = true;
  });
  return { nextCalled, res };
}

describe('Middleware: MFA account access', function () {
  const middleware = createMfaSessionMiddleware();

  it('allows anonymous and verified sessions to continue', function () {
    invoke(middleware, {
      path: '/api/auth/signin',
    }).nextCalled.should.be.true();
    invoke(middleware, {
      path: '/api/admin/dashboard',
      user: {
        roles: ['admin'],
        mfaEnabled: true,
        $locals: { mfaVerified: true },
      },
    }).nextCalled.should.be.true();
  });

  it('restricts an unenrolled privileged account to MFA setup', function () {
    const user = { roles: ['admin', 'user'], mfaEnabled: false, $locals: {} };
    invoke(middleware, {
      user,
      path: '/profile/edit/account',
    }).nextCalled.should.be.true();
    const blocked = invoke(middleware, {
      user,
      path: '/api/admin/dashboard',
    });
    blocked.res.statusCode.should.equal(403);
    blocked.res.body.mfaRequired.should.be.true();
    const redirected = invoke(middleware, { user, path: '/admin' });
    redirected.res.redirectUrl.should.equal('/profile/edit/account');
  });

  it('blocks authenticated access for an enrolled but unverified session', function () {
    const user = { roles: ['user'], mfaEnabled: true, $locals: {} };
    const blocked = invoke(middleware, {
      user,
      path: '/api/users/export',
    });
    blocked.res.statusCode.should.equal(403);
    blocked.res.body.mfaRequired.should.be.true();
    const redirected = invoke(middleware, { user, path: '/profile/edit' });
    redirected.res.redirectUrl.should.equal('/signin');
    invoke(middleware, {
      user,
      path: '/api/users/mfa',
    }).nextCalled.should.be.true();
  });
});
