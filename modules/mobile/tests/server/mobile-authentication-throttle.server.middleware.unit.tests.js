const EventEmitter = require('events');
const mongoose = require('mongoose');
const should = require('should');
const sinon = require('sinon');

const mobileAuthenticationThrottle = require('../../server/middleware/mobile-authentication-throttle.server.middleware');

const MobileAuthenticationAttempt = mongoose.model(
  'MobileAuthenticationAttempt',
);

function response() {
  const res = new EventEmitter();
  res.headers = {};
  res.set = sinon.stub().callsFake(function (name, value) {
    res.headers[name] = value;
    return res;
  });
  res.status = sinon.stub().callsFake(function (statusCode) {
    res.statusCode = statusCode;
    return res;
  });
  res.send = sinon.stub().callsFake(function (body) {
    res.body = body;
    return res;
  });
  return res;
}

function queryResult(err, value) {
  return { exec: sinon.stub().callsArgWith(0, err, value) };
}

function request(
  username = 'example_member',
  passengerAddress,
  directAddress = '203.0.113.9',
) {
  return {
    body: { username },
    connection: { remoteAddress: directAddress },
    get: sinon.stub().returns(passengerAddress),
    ip: directAddress,
    socket: { remoteAddress: directAddress },
  };
}

function allowExpiredDeletion() {
  return sinon.stub(MobileAuthenticationAttempt, 'deleteOne').returns({
    exec: sinon.stub().callsFake(function (callback) {
      if (callback) callback(null);
    }),
  });
}

describe('Mobile authentication throttle', function () {
  afterEach(function () {
    sinon.restore();
  });

  it('passes expired-attempt deletion errors to the error handler', function () {
    const error = new Error('Attempt deletion failed');
    const next = sinon.stub();
    sinon
      .stub(MobileAuthenticationAttempt, 'deleteOne')
      .returns(queryResult(error));

    mobileAuthenticationThrottle.signin(request(), response(), next);

    sinon.assert.calledOnceWithExactly(next, error);
  });

  it('uses an empty identifier when a sign-in attempt has no username', function () {
    const next = sinon.stub();
    allowExpiredDeletion();
    sinon
      .stub(MobileAuthenticationAttempt, 'findOneAndUpdate')
      .returns(queryResult(null, { count: 1 }));

    mobileAuthenticationThrottle.signin(request(null), response(), next);

    sinon.assert.calledOnceWithExactly(next);
  });

  it('passes atomic increment errors to the error handler', function () {
    const error = new Error('Attempt increment failed');
    const next = sinon.stub();
    allowExpiredDeletion();
    sinon
      .stub(MobileAuthenticationAttempt, 'findOneAndUpdate')
      .returns(queryResult(error));

    mobileAuthenticationThrottle.signin(request(), response(), next);

    sinon.assert.calledOnceWithExactly(next, error);
  });

  it('retries an upsert race without allowing an attempt through twice', function () {
    const duplicate = new Error('Duplicate key');
    duplicate.code = 11000;
    const next = sinon.stub();
    allowExpiredDeletion();
    const increment = sinon.stub(
      MobileAuthenticationAttempt,
      'findOneAndUpdate',
    );
    increment.onFirstCall().returns(queryResult(duplicate));
    increment.onSecondCall().returns(queryResult(null, { count: 1 }));

    mobileAuthenticationThrottle.signin(request(), response(), next);

    sinon.assert.calledTwice(increment);
    increment.secondCall.args[2].upsert.should.equal(false);
    sinon.assert.calledOnceWithExactly(next);
  });

  it('rejects a missing atomic counter result', function () {
    const next = sinon.stub();
    allowExpiredDeletion();
    sinon
      .stub(MobileAuthenticationAttempt, 'findOneAndUpdate')
      .returns(queryResult(null, null));

    mobileAuthenticationThrottle.signin(request(), response(), next);

    sinon.assert.calledOnce(next);
    next.firstCall.args[0].message.should.equal(
      'Authentication attempt was not recorded.',
    );
  });

  it('returns a stable rate-limit response', function () {
    const res = response();
    const next = sinon.stub();
    allowExpiredDeletion();
    sinon.stub(MobileAuthenticationAttempt, 'findOneAndUpdate').returns(
      queryResult(null, {
        count: mobileAuthenticationThrottle.attemptLimit + 1,
      }),
    );

    mobileAuthenticationThrottle.signin(request(), res, next);

    res.statusCode.should.equal(429);
    res.body.code.should.equal('rate_limited');
    res.headers['Retry-After'].should.equal(
      String(mobileAuthenticationThrottle.attemptWindowMs / 1000),
    );
    sinon.assert.notCalled(next);
  });

  it('clears the atomic failure budget after a successful response', function () {
    const res = response();
    const next = sinon.stub();
    const deletion = allowExpiredDeletion();
    sinon
      .stub(MobileAuthenticationAttempt, 'findOneAndUpdate')
      .returns(queryResult(null, { count: 1 }));

    mobileAuthenticationThrottle.signin(request(), res, next);
    res.statusCode = 200;
    res.emit('finish');

    sinon.assert.calledOnceWithExactly(next);
    sinon.assert.calledTwice(deletion);
  });

  it('retains the atomic failure budget after a rejected response', function () {
    const res = response();
    const next = sinon.stub();
    const deletion = allowExpiredDeletion();
    sinon
      .stub(MobileAuthenticationAttempt, 'findOneAndUpdate')
      .returns(queryResult(null, { count: 1 }));

    mobileAuthenticationThrottle.signin(request(), res, next);
    res.statusCode = 401;
    res.emit('finish');

    sinon.assert.calledOnce(deletion);
  });

  it('trusts the Passenger address only over a loopback app connection', function () {
    mobileAuthenticationThrottle
      .sourceAddress(request('member', '198.51.100.7', '127.0.0.1'))
      .should.equal('198.51.100.7');
    mobileAuthenticationThrottle
      .sourceAddress(request('member', '198.51.100.7', '203.0.113.9'))
      .should.equal('203.0.113.9');
  });

  it('falls back safely when request address helpers are absent', function () {
    mobileAuthenticationThrottle
      .sourceAddress({ body: {}, connection: {} })
      .should.equal('unknown');
  });

  it('stores one unique counter that expires with the failure window', function () {
    const indexes = MobileAuthenticationAttempt.schema.indexes();
    const keyIndex = indexes.find(function (index) {
      return index[0].key === 1;
    });
    const ttlIndex = indexes.find(function (index) {
      return index[0].expiresAt === 1;
    });

    should.exist(keyIndex);
    keyIndex[1].unique.should.equal(true);
    should.exist(ttlIndex);
    ttlIndex[1].expireAfterSeconds.should.equal(0);
  });
});
