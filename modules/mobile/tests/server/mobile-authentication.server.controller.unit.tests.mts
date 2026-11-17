import mongoose from 'mongoose';
import should from 'should';
import sinon from 'sinon';

import mobileAuthentication from '../../server/controllers/mobile-authentication.server.controller.cjs';
import mobileSession from '../../server/services/mobile-session.server.service.cjs';
import passwordHashing from '../../../users/server/services/password-hashing.server.service.mts';

const User = mongoose.model('User');
const MobileSession = mongoose.model('MobileSession');
const validToken = 'a'.repeat(64);

describe('Mobile credential versions and persistence failures', function () {
  afterEach(function () {
    sinon.restore();
  });

  for (const [storedVersion, currentVersion] of [
    [1, 2],
    [undefined, 1],
    [1, undefined],
  ]) {
    for (const operation of ['authenticate', 'refresh'] as const) {
      it(`rejects ${operation} with credential versions ${storedVersion}/${currentVersion}`, function () {
        const session = {
          authVersion: storedVersion,
          user: { roles: ['user'], authVersion: currentVersion },
        };
        const method =
          operation === 'authenticate'
            ? 'findByAccessToken'
            : 'rotateRefreshToken';
        sinon.stub(mobileSession, method).callsArgWith(1, null, session);
        const res = response();
        const next = sinon.stub();

        mobileAuthentication[operation](
          {
            get: sinon.stub().returns(`Bearer ${validToken}`),
            body: { refreshToken: validToken },
          },
          res,
          next,
        );

        res.statusCode.should.equal(401);
        sinon.assert.notCalled(next);
      });
    }
  }

  it('passes failed invalid-credential verification to the error handler', async function () {
    const error = new Error('Password verification unavailable');
    const verify = sinon.stub(passwordHashing, 'verifyPassword').rejects(error);
    const next = sinon.stub();

    await mobileAuthentication.signin(
      { body: { username: 'examplemember', password: 'a'.repeat(1025) } },
      response(),
      next,
    );

    sinon.assert.calledOnceWithExactly(verify, '', null, null);
    sinon.assert.calledOnceWithExactly(next, error);
  });

  it('returns access-token lookup failures through the service callback', async function () {
    const error = new Error('Session lookup unavailable');
    sinon.stub(MobileSession, 'findOne').returns(sessionLookupResult(error));
    const [receivedError, session] = await serviceResult(callback =>
      mobileSession.findByAccessToken(validToken, callback),
    );

    should(receivedError).equal(error);
    should.not.exist(session);
  });

  it('reports refresh reuse revocation failures', async function () {
    const error = new Error('Session update unavailable');
    sinon.stub(MobileSession, 'findOneAndUpdate').rejects(error);
    const [receivedError, session, tokens] = await serviceResult(callback =>
      mobileSession.revokeForRefreshTokenReuse('example-hash', callback),
    );

    should(receivedError).equal(error);
    should.not.exist(session);
    should.not.exist(tokens);
  });

  it('reports sign-out persistence failures', async function () {
    const error = new Error('Session persistence unavailable');
    const session = { save: sinon.stub().rejects(error) };
    const [receivedError] = await serviceResult(callback =>
      mobileSession.revoke(session, callback),
    );

    should(receivedError).equal(error);
  });
});

function response() {
  const res = {
    statusCode: 200,
    body: {} as Record<string, unknown>,
    set: sinon.stub(),
    status: sinon.stub(),
    send: sinon.stub(),
    json: sinon.stub(),
  };
  res.set = sinon.stub().returns(res);
  res.status = sinon.stub().callsFake(function (statusCode: number) {
    res.statusCode = statusCode;
    return res;
  });
  res.send = sinon.stub().callsFake(function (body: Record<string, unknown>) {
    res.body = body;
    return res;
  });
  res.json = sinon.stub().callsFake(function (body: Record<string, unknown>) {
    res.body = body;
    return res;
  });
  return res;
}

function sessionLookupResult(err: Error | null, session?: object | null) {
  const promise = err ? Promise.reject(err) : Promise.resolve(session);
  return {
    populate() {
      return this;
    },
    then: promise.then.bind(promise),
  } as unknown as ReturnType<typeof MobileSession.findOne>;
}

function serviceResult(
  run: (callback: (...values: unknown[]) => void) => void,
) {
  return new Promise<unknown[]>(resolve => run((...values) => resolve(values)));
}

describe('Mobile authentication controller error branches', function () {
  afterEach(function () {
    sinon.restore();
  });

  it('formats a pre-release API build identifier in UTC', function () {
    mobileAuthentication
      .buildVersion('2026-07-16T12:34:56.000Z')
      .should.equal('v0.1-20260716-1234');
  });

  it('does not disclose revision metadata', function () {
    const res = response();
    const req = {
      app: {
        locals: {
          appSettings: { time: '2026-07-16T12:34:56.000Z' },
        },
      },
    };

    mobileAuthentication.status(req, res);

    res.body.should.deepEqual({
      contractVersion: 'v0',
      buildVersion: 'v0.1-20260716-1234',
      startedAt: '2026-07-16T12:34:56.000Z',
    });
  });

  it('rejects a request without a bearer token', function () {
    const req = { get: sinon.stub().returns(undefined) };
    const res = response();
    const next = sinon.stub();

    mobileAuthentication.authenticate(req, res, next);

    res.statusCode.should.equal(401);
    should(res.body.code).equal('authentication_required');
    should(res.body.message).equal('Mobile authentication is required.');
    sinon.assert.notCalled(next);
  });

  it('passes access-token lookup errors to the error handler', function () {
    const error = new Error('Access-token lookup failed');
    const req = { get: sinon.stub().returns(`Bearer ${validToken}`) };
    const res = response();
    const next = sinon.stub();
    sinon.stub(mobileSession, 'findByAccessToken').callsArgWith(1, error);

    mobileAuthentication.authenticate(req, res, next);

    sinon.assert.calledOnceWithExactly(next, error);
  });

  it('rejects an access token belonging to a suspended member', function () {
    const req = { get: sinon.stub().returns(`Bearer ${validToken}`) };
    const res = response();
    const next = sinon.stub();
    sinon
      .stub(mobileSession, 'findByAccessToken')
      .callsArgWith(1, null, { user: { roles: ['suspended'] } });

    mobileAuthentication.authenticate(req, res, next);

    res.statusCode.should.equal(401);
    sinon.assert.notCalled(next);
  });

  it('rejects malformed bearer tokens before database lookup', function () {
    const req = { get: sinon.stub().returns('Bearer not-an-opaque-token') };
    const res = response();
    const next = sinon.stub();
    const lookup = sinon.stub(mobileSession, 'findByAccessToken');

    mobileAuthentication.authenticate(req, res, next);

    res.statusCode.should.equal(401);
    sinon.assert.notCalled(lookup);
    sinon.assert.notCalled(next);
  });

  it('rejects missing sign-in credentials', async function () {
    const res = response();

    await mobileAuthentication.signin({ body: {} }, res, sinon.stub());

    res.statusCode.should.equal(401);
  });

  it('rejects a missing sign-in password', async function () {
    const res = response();

    await mobileAuthentication.signin(
      { body: { username: 'example_member' } },
      res,
      sinon.stub(),
    );

    res.statusCode.should.equal(401);
  });

  it('rejects oversized credentials before member lookup', async function () {
    const res = response();
    const lookup = sinon.stub(User, 'findOne');

    await mobileAuthentication.signin(
      { body: { username: 'a'.repeat(255), password: 'secret' } },
      res,
      sinon.stub(),
    );

    res.statusCode.should.equal(401);
    sinon.assert.notCalled(lookup);
  });

  it('passes member lookup errors to the error handler', async function () {
    const error = new Error('Member lookup failed');
    const next = sinon.stub();
    sinon.stub(User, 'findOne').rejects(error);

    await mobileAuthentication.signin(
      { body: { username: 'example_member', password: 'secret' } },
      response(),
      next,
    );

    sinon.assert.calledOnceWithExactly(next, error);
  });

  it('rejects an unknown member', async function () {
    const res = response();
    sinon.stub(User, 'findOne').resolves(null);
    const verifyPassword = sinon
      .stub(passwordHashing, 'verifyPassword')
      .resolves(false as never);

    await mobileAuthentication.signin(
      { body: { username: 'unknown_member', password: 'secret' } },
      res,
      sinon.stub(),
    );

    res.statusCode.should.equal(401);
    sinon.assert.calledOnceWithExactly(verifyPassword, 'secret', null, null);
  });

  it('rejects a suspended member at sign-in', async function () {
    const res = response();
    const suspendedMember = {
      roles: ['suspended'],
      authenticate: sinon.stub(),
    };
    sinon.stub(User, 'findOne').resolves(suspendedMember);
    const verifyPassword = sinon
      .stub(passwordHashing, 'verifyPassword')
      .resolves(false as never);

    await mobileAuthentication.signin(
      { body: { username: 'suspended_member', password: 'secret' } },
      res,
      sinon.stub(),
    );

    res.statusCode.should.equal(401);
    sinon.assert.notCalled(suspendedMember.authenticate);
    sinon.assert.calledOnceWithExactly(verifyPassword, 'secret', null, null);
  });

  it('passes session creation errors to the error handler', async function () {
    const error = new Error('Session creation failed');
    const next = sinon.stub();
    const activeMember = {
      roles: ['user'],
      authenticate: sinon.stub().resolves(true),
    };
    sinon.stub(User, 'findOne').resolves(activeMember);
    sinon.stub(mobileSession, 'create').callsArgWith(1, error, null);

    await mobileAuthentication.signin(
      { body: { username: 'example_member', password: 'secret' } },
      response(),
      next,
    );

    sinon.assert.calledOnceWithExactly(next, error);
  });

  it('rejects a missing refresh token', function () {
    const res = response();

    mobileAuthentication.refresh({ body: {} }, res, sinon.stub());

    res.statusCode.should.equal(401);
  });

  it('passes refresh-token errors to the error handler', function () {
    const error = new Error('Refresh failed');
    const next = sinon.stub();
    sinon.stub(mobileSession, 'rotateRefreshToken').callsArgWith(1, error);

    mobileAuthentication.refresh(
      { body: { refreshToken: validToken } },
      response(),
      next,
    );

    sinon.assert.calledOnceWithExactly(next, error);
  });

  it('rejects a refresh token belonging to a suspended member', function () {
    const res = response();
    sinon
      .stub(mobileSession, 'rotateRefreshToken')
      .callsArgWith(1, null, { user: { roles: ['suspended'] } }, null);

    mobileAuthentication.refresh(
      { body: { refreshToken: validToken } },
      res,
      sinon.stub(),
    );

    res.statusCode.should.equal(401);
  });

  it('passes sign-out errors to the error handler', function () {
    const error = new Error('Sign-out failed');
    const next = sinon.stub();
    const req = { mobileSession: {} };
    sinon.stub(mobileSession, 'revoke').callsArgWith(1, error);

    mobileAuthentication.signout(req, response(), next);

    sinon.assert.calledOnceWithExactly(next, error);
  });
});

describe('Mobile session service error branches', function () {
  afterEach(function () {
    sinon.restore();
  });

  it('does not return tokens when saving a session fails', async function () {
    const error = new Error('Session save failed');
    sinon.stub(MobileSession.prototype, 'save').rejects(error);
    const [sessionError, tokens] = await serviceResult(callback =>
      mobileSession.create({ _id: new mongoose.Types.ObjectId() }, callback),
    );
    should(sessionError).equal(error);
    should.not.exist(tokens);
  });

  it('returns a refresh-token lookup error', async function () {
    const error = new Error('Refresh lookup failed');
    sinon.stub(MobileSession, 'findOne').returns(sessionLookupResult(error));
    const [sessionError, session, tokens] = await serviceResult(callback =>
      mobileSession.rotateRefreshToken('opaque-refresh-token', callback),
    );
    should(sessionError).equal(error);
    should.not.exist(session);
    should.not.exist(tokens);
  });

  it('rejects an unrecognised refresh token without revoking a session', async function () {
    sinon
      .stub(MobileSession, 'findOne')
      .returns(sessionLookupResult(null, null));
    const revoke = sinon.stub(MobileSession, 'findOneAndUpdate').resolves(null);
    const [sessionError, session, tokens] = await serviceResult(callback =>
      mobileSession.rotateRefreshToken('unknown-refresh-token', callback),
    );
    should.not.exist(sessionError);
    should.not.exist(session);
    should.not.exist(tokens);
    sinon.assert.calledOnce(revoke);
  });

  it('does not mutate a suspended member session', async function () {
    sinon.stub(MobileSession, 'findOne').returns(
      sessionLookupResult(null, {
        _id: new mongoose.Types.ObjectId(),
        user: { roles: ['suspended'] },
      }),
    );
    const update = sinon.stub(MobileSession, 'findOneAndUpdate');

    const [sessionError, session, tokens] = await serviceResult(callback =>
      mobileSession.rotateRefreshToken('suspended-refresh-token', callback),
    );
    should.not.exist(sessionError);
    should.not.exist(session);
    should.not.exist(tokens);

    sinon.assert.notCalled(update);
  });

  it('returns a refresh-token update error', async function () {
    const error = new Error('Refresh update failed');
    sinon.stub(MobileSession, 'findOne').returns(
      sessionLookupResult(null, {
        _id: new mongoose.Types.ObjectId(),
        user: { roles: ['user'] },
      }),
    );
    sinon.stub(MobileSession, 'findOneAndUpdate').rejects(error);
    const [sessionError, session, tokens] = await serviceResult(callback =>
      mobileSession.rotateRefreshToken('opaque-refresh-token', callback),
    );
    should(sessionError).equal(error);
    should.not.exist(session);
    should.not.exist(tokens);
  });

  it('revokes the session when another request already rotated the token', async function () {
    sinon.stub(MobileSession, 'findOne').returns(
      sessionLookupResult(null, {
        _id: new mongoose.Types.ObjectId(),
        user: { roles: ['user'] },
      }),
    );
    const update = sinon.stub(MobileSession, 'findOneAndUpdate');
    update.onFirstCall().resolves(null);
    update.onSecondCall().resolves({});
    const [sessionError, session, tokens] = await serviceResult(callback =>
      mobileSession.rotateRefreshToken('already-rotated-token', callback),
    );
    should.not.exist(sessionError);
    should.not.exist(session);
    should.not.exist(tokens);
    sinon.assert.calledTwice(update);
  });

  it('expires stored sessions at refresh-token expiry', function () {
    const ttlIndex = MobileSession.schema.indexes().find(function (index) {
      return index[0].refreshExpiresAt === 1;
    });

    should(ttlIndex?.[1].expireAfterSeconds).equal(0);
  });
});
