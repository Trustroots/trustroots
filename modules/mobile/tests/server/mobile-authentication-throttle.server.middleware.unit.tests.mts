import EventEmitter from 'events';
import mongoose from 'mongoose';
import should from 'should';
import sinon from 'sinon';

import mobileAuthenticationThrottle from '../../server/middleware/mobile-authentication-throttle.server.middleware.cjs';

const MobileAuthenticationAttempt = mongoose.model(
  'MobileAuthenticationAttempt',
);

function response() {
  const res = Object.assign(new EventEmitter(), {
    headers: {} as Record<string, string>,
    statusCode: 200,
    body: {} as { code?: string },
    set: sinon.stub(),
    status: sinon.stub(),
    send: sinon.stub(),
  });
  res.set = sinon.stub().callsFake(function (name: string, value: string) {
    res.headers[name] = value;
    return res;
  });
  res.status = sinon.stub().callsFake(function (statusCode: number) {
    res.statusCode = statusCode;
    return res;
  });
  res.send = sinon.stub().callsFake(function (body: { code?: string }) {
    res.body = body;
    return res;
  });
  return res;
}

function queryResult(err: Error | null, value?: object | null) {
  const pending = err ? Promise.reject(err) : Promise.resolve(value);
  return Object.assign(pending, {
    exec: sinon.stub().returns(pending),
  }) as never;
}

function request(
  username: string | null = 'example_member',
  passengerAddress?: string,
  directAddress = '203.0.113.9',
) {
  return {
    body: { username, refreshToken: undefined as string | undefined },
    connection: { remoteAddress: directAddress },
    get: sinon.stub().returns(passengerAddress),
    ip: directAddress,
    socket: { remoteAddress: directAddress },
  };
}

function allowExpiredDeletion() {
  return sinon
    .stub(MobileAuthenticationAttempt, 'deleteOne')
    .returns(queryResult(null));
}

describe('Mobile authentication throttle', function () {
  afterEach(function () {
    sinon.restore();
  });

  it('passes expired-attempt deletion errors to the error handler', async function () {
    const error = new Error('Attempt deletion failed');
    const next = sinon.stub();
    sinon
      .stub(MobileAuthenticationAttempt, 'deleteOne')
      .returns(queryResult(error));

    mobileAuthenticationThrottle.signin(request(), response(), next);
    await new Promise(resolve => setImmediate(resolve));

    sinon.assert.calledOnceWithExactly(next, error);
  });

  it('uses an empty identifier when a sign-in attempt has no username', async function () {
    const next = sinon.stub();
    allowExpiredDeletion();
    sinon
      .stub(MobileAuthenticationAttempt, 'findOneAndUpdate')
      .onFirstCall()
      .returns(queryResult(null, { count: 1 }))
      .onSecondCall()
      .returns(queryResult(null, { count: 1 }));

    mobileAuthenticationThrottle.signin(request(null), response(), next);
    await new Promise(resolve => setImmediate(resolve));

    sinon.assert.calledOnceWithExactly(next);
  });

  it('passes atomic increment errors to the error handler', async function () {
    const error = new Error('Attempt increment failed');
    const next = sinon.stub();
    allowExpiredDeletion();
    sinon
      .stub(MobileAuthenticationAttempt, 'findOneAndUpdate')
      .returns(queryResult(error));

    mobileAuthenticationThrottle.signin(request(), response(), next);
    await new Promise(resolve => setImmediate(resolve));

    sinon.assert.calledOnceWithExactly(next, error);
  });

  it('retries an upsert race without allowing an attempt through twice', async function () {
    const duplicate = Object.assign(new Error('Duplicate key'), {
      code: 11000,
    });
    const next = sinon.stub();
    allowExpiredDeletion();
    const increment = sinon.stub(
      MobileAuthenticationAttempt,
      'findOneAndUpdate',
    );
    increment.onFirstCall().returns(queryResult(duplicate));
    increment.onSecondCall().returns(queryResult(null, { count: 1 }));
    increment.onThirdCall().returns(queryResult(null, { count: 1 }));

    mobileAuthenticationThrottle.signin(request(), response(), next);
    await new Promise(resolve => setImmediate(resolve));

    sinon.assert.calledThrice(increment);
    should(increment.secondCall.args[2]?.upsert).equal(false);
    sinon.assert.calledOnceWithExactly(next);
  });

  it('rejects a missing atomic counter result', async function () {
    const next = sinon.stub();
    allowExpiredDeletion();
    sinon
      .stub(MobileAuthenticationAttempt, 'findOneAndUpdate')
      .returns(queryResult(null, null));

    mobileAuthenticationThrottle.signin(request(), response(), next);
    await new Promise(resolve => setImmediate(resolve));

    sinon.assert.calledOnce(next);
    next.firstCall.args[0].message.should.equal(
      'Authentication attempt was not recorded.',
    );
  });

  it('returns a stable rate-limit response', async function () {
    const res = response();
    const next = sinon.stub();
    allowExpiredDeletion();
    sinon.stub(MobileAuthenticationAttempt, 'findOneAndUpdate').returns(
      queryResult(null, {
        count: mobileAuthenticationThrottle.attemptLimit + 1,
      }),
    );

    mobileAuthenticationThrottle.signin(request(), res, next);
    await new Promise(resolve => setImmediate(resolve));

    res.statusCode.should.equal(429);
    should(res.body.code).equal('rate_limited');
    res.headers['Retry-After'].should.equal(
      String(mobileAuthenticationThrottle.attemptWindowMs / 1000),
    );
    sinon.assert.notCalled(next);
  });

  it('clears the atomic failure budget after a successful response', async function () {
    const res = response();
    const next = sinon.stub();
    const deletion = allowExpiredDeletion();
    sinon
      .stub(MobileAuthenticationAttempt, 'findOneAndUpdate')
      .returns(queryResult(null, { count: 1 }));

    mobileAuthenticationThrottle.signin(request(), res, next);
    await new Promise(resolve => setImmediate(resolve));
    res.statusCode = 200;
    res.emit('finish');

    sinon.assert.calledOnceWithExactly(next);
    sinon.assert.callCount(deletion, 4);
  });

  it('retains the atomic failure budget after a rejected response', async function () {
    const res = response();
    const next = sinon.stub();
    const deletion = allowExpiredDeletion();
    sinon
      .stub(MobileAuthenticationAttempt, 'findOneAndUpdate')
      .returns(queryResult(null, { count: 1 }));

    mobileAuthenticationThrottle.signin(request(), res, next);
    await new Promise(resolve => setImmediate(resolve));
    res.statusCode = 401;
    res.emit('finish');

    sinon.assert.calledTwice(deletion);
  });

  it('applies both the IP and token budgets to refresh attempts', async function () {
    const next = sinon.stub();
    allowExpiredDeletion();
    const increment = sinon
      .stub(MobileAuthenticationAttempt, 'findOneAndUpdate')
      .onFirstCall()
      .returns(queryResult(null, { count: 1 }))
      .onSecondCall()
      .returns(queryResult(null, { count: 1 }));
    const req = request();
    req.body.refreshToken = 'a'.repeat(64);

    mobileAuthenticationThrottle.refresh(req, response(), next);
    await new Promise(resolve => setImmediate(resolve));

    sinon.assert.calledTwice(increment);
    sinon.assert.calledOnceWithExactly(next);
  });

  it('passes refresh IP-budget errors to the error handler', async function () {
    const error = new Error('Refresh attempt deletion failed');
    const next = sinon.stub();
    sinon
      .stub(MobileAuthenticationAttempt, 'deleteOne')
      .returns(queryResult(error));

    mobileAuthenticationThrottle.refresh(request(), response(), next);
    await new Promise(resolve => setImmediate(resolve));

    sinon.assert.calledOnceWithExactly(next, error);
  });

  it('uses an empty token identity when a refresh token is missing', async function () {
    const next = sinon.stub();
    allowExpiredDeletion();
    sinon
      .stub(MobileAuthenticationAttempt, 'findOneAndUpdate')
      .returns(queryResult(null, { count: 1 }));

    mobileAuthenticationThrottle.refresh(request(), response(), next);
    await new Promise(resolve => setImmediate(resolve));

    sinon.assert.calledOnceWithExactly(next);
  });

  it('trusts the Passenger address only over a loopback app connection', async function () {
    mobileAuthenticationThrottle
      .sourceAddress(request('member', '198.51.100.7', '127.0.0.1'))
      .should.equal('198.51.100.7');
    mobileAuthenticationThrottle
      .sourceAddress(request('member', '198.51.100.7', '203.0.113.9'))
      .should.equal('203.0.113.9');
  });

  it('falls back safely when request address helpers are absent', async function () {
    mobileAuthenticationThrottle
      .sourceAddress({ body: {}, connection: {} })
      .should.equal('unknown');
  });

  it('stores one unique counter that expires with the failure window', async function () {
    const indexes = MobileAuthenticationAttempt.schema.indexes();
    const keyIndex = indexes.find(function (index) {
      return index[0].key === 1;
    });
    const ttlIndex = indexes.find(function (index) {
      return index[0].expiresAt === 1;
    });

    should.exist(keyIndex);
    should(keyIndex?.[1].unique).equal(true);
    should.exist(ttlIndex);
    should(ttlIndex?.[1].expireAfterSeconds).equal(0);
  });
});
