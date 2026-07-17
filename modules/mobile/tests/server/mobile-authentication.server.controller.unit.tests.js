const mongoose = require('mongoose');
const should = require('should');
const sinon = require('sinon');

const mobileAuthentication = require('../../server/controllers/mobile-authentication.server.controller');
const mobileSession = require('../../server/services/mobile-session.server.service');

const User = mongoose.model('User');
const MobileSession = mongoose.model('MobileSession');
const validToken = 'a'.repeat(64);

function response() {
  const res = {};
  res.set = sinon.stub().returns(res);
  res.status = sinon.stub().callsFake(function (statusCode) {
    res.statusCode = statusCode;
    return res;
  });
  res.send = sinon.stub().callsFake(function (body) {
    res.body = body;
    return res;
  });
  res.json = sinon.stub().callsFake(function (body) {
    res.body = body;
    return res;
  });
  return res;
}

function userLookupResult(err, user) {
  return {
    exec: sinon.stub().callsArgWith(0, err, user),
  };
}

function sessionLookupResult(err, session) {
  const query = {
    exec: sinon.stub().callsArgWith(0, err, session),
    populate: sinon.stub(),
  };
  query.populate.returns(query);
  return query;
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

  it('reports an unknown revision when build metadata is unavailable', function () {
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
      revision: null,
    });
  });

  it('rejects a request without a bearer token', function () {
    const req = { get: sinon.stub().returns(undefined) };
    const res = response();
    const next = sinon.stub();

    mobileAuthentication.authenticate(req, res, next);

    res.statusCode.should.equal(401);
    res.body.code.should.equal('authentication_required');
    res.body.message.should.equal('Mobile authentication is required.');
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

  it('rejects missing sign-in credentials', function () {
    const res = response();

    mobileAuthentication.signin({ body: {} }, res, sinon.stub());

    res.statusCode.should.equal(401);
  });

  it('rejects a missing sign-in password', function () {
    const res = response();

    mobileAuthentication.signin(
      { body: { username: 'example_member' } },
      res,
      sinon.stub(),
    );

    res.statusCode.should.equal(401);
  });

  it('rejects oversized credentials before member lookup', function () {
    const res = response();
    const lookup = sinon.stub(User, 'findOne');

    mobileAuthentication.signin(
      { body: { username: 'a'.repeat(255), password: 'secret' } },
      res,
      sinon.stub(),
    );

    res.statusCode.should.equal(401);
    sinon.assert.notCalled(lookup);
  });

  it('passes member lookup errors to the error handler', function () {
    const error = new Error('Member lookup failed');
    const next = sinon.stub();
    sinon.stub(User, 'findOne').returns(userLookupResult(error));

    mobileAuthentication.signin(
      { body: { username: 'example_member', password: 'secret' } },
      response(),
      next,
    );

    sinon.assert.calledOnceWithExactly(next, error);
  });

  it('rejects an unknown member', function () {
    const res = response();
    sinon.stub(User, 'findOne').returns(userLookupResult(null, null));

    mobileAuthentication.signin(
      { body: { username: 'unknown_member', password: 'secret' } },
      res,
      sinon.stub(),
    );

    res.statusCode.should.equal(401);
  });

  it('rejects a suspended member at sign-in', function () {
    const res = response();
    const suspendedMember = {
      roles: ['suspended'],
      authenticate: sinon.stub(),
    };
    sinon
      .stub(User, 'findOne')
      .returns(userLookupResult(null, suspendedMember));

    mobileAuthentication.signin(
      { body: { username: 'suspended_member', password: 'secret' } },
      res,
      sinon.stub(),
    );

    res.statusCode.should.equal(401);
    sinon.assert.notCalled(suspendedMember.authenticate);
  });

  it('passes session creation errors to the error handler', function () {
    const error = new Error('Session creation failed');
    const next = sinon.stub();
    const activeMember = {
      roles: ['user'],
      authenticate: sinon.stub().returns(true),
    };
    sinon.stub(User, 'findOne').returns(userLookupResult(null, activeMember));
    sinon.stub(mobileSession, 'create').callsArgWith(1, error, null);

    mobileAuthentication.signin(
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

  it('does not return tokens when saving a session fails', function () {
    const error = new Error('Session save failed');
    sinon.stub(MobileSession.prototype, 'save').callsArgWith(0, error);

    mobileSession.create(
      { _id: new mongoose.Types.ObjectId() },
      function (sessionError, tokens) {
        sessionError.should.equal(error);
        should.not.exist(tokens);
      },
    );
  });

  it('returns a refresh-token lookup error', function () {
    const error = new Error('Refresh lookup failed');
    sinon.stub(MobileSession, 'findOne').returns(sessionLookupResult(error));

    mobileSession.rotateRefreshToken(
      'opaque-refresh-token',
      function (sessionError, session, tokens) {
        sessionError.should.equal(error);
        should.not.exist(session);
        should.not.exist(tokens);
      },
    );
  });

  it('returns no tokens when a refresh session does not exist', function () {
    sinon
      .stub(MobileSession, 'findOne')
      .returns(sessionLookupResult(null, null));

    mobileSession.rotateRefreshToken(
      'unknown-refresh-token',
      function (sessionError, session, tokens) {
        should.not.exist(sessionError);
        should.not.exist(session);
        should.not.exist(tokens);
      },
    );
  });

  it('does not mutate a suspended member session', function () {
    sinon.stub(MobileSession, 'findOne').returns(
      sessionLookupResult(null, {
        _id: new mongoose.Types.ObjectId(),
        user: { roles: ['suspended'] },
      }),
    );
    const update = sinon.stub(MobileSession, 'findOneAndUpdate');

    mobileSession.rotateRefreshToken(
      'suspended-refresh-token',
      function (sessionError, session, tokens) {
        should.not.exist(sessionError);
        should.not.exist(session);
        should.not.exist(tokens);
      },
    );

    sinon.assert.notCalled(update);
  });

  it('returns a refresh-token update error', function () {
    const error = new Error('Refresh update failed');
    sinon.stub(MobileSession, 'findOne').returns(
      sessionLookupResult(null, {
        _id: new mongoose.Types.ObjectId(),
        user: { roles: ['user'] },
      }),
    );
    sinon.stub(MobileSession, 'findOneAndUpdate').callsArgWith(3, error);

    mobileSession.rotateRefreshToken(
      'opaque-refresh-token',
      function (sessionError, session, tokens) {
        sessionError.should.equal(error);
        should.not.exist(session);
        should.not.exist(tokens);
      },
    );
  });

  it('returns no tokens when another request already rotated the token', function () {
    sinon.stub(MobileSession, 'findOne').returns(
      sessionLookupResult(null, {
        _id: new mongoose.Types.ObjectId(),
        user: { roles: ['user'] },
      }),
    );
    sinon.stub(MobileSession, 'findOneAndUpdate').callsArgWith(3, null, null);

    mobileSession.rotateRefreshToken(
      'already-rotated-token',
      function (sessionError, session, tokens) {
        should.not.exist(sessionError);
        should.not.exist(session);
        should.not.exist(tokens);
      },
    );
  });

  it('expires stored sessions at refresh-token expiry', function () {
    const ttlIndex = MobileSession.schema.indexes().find(function (index) {
      return index[0].refreshExpiresAt === 1;
    });

    ttlIndex[1].expireAfterSeconds.should.equal(0);
  });
});
