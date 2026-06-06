const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
require('should');

function loadPolicy() {
  const mockAcl = {
    allow: sinon.stub(),
    areAnyRolesAllowed: sinon.stub(),
  };
  const AclConstructor = function () {
    return mockAcl;
  };
  AclConstructor.memoryBackend = sinon.stub();
  const policy = proxyquire('../../server/policies/offers.server.policy', {
    acl: AclConstructor,
  });
  return { policy, mockAcl };
}

function mockResponse() {
  const res = { statusCode: 200, body: null };
  res.status = code => {
    res.statusCode = code;
    return res;
  };
  res.send = body => {
    res.body = body;
    return res;
  };
  res.json = body => {
    res.body = body;
    return res;
  };
  return res;
}

describe('Offers policy unit tests', () => {
  it('returns 403 for unpublished users', done => {
    const { policy } = loadPolicy();
    const res = mockResponse();
    let nextCalled = false;

    policy.isAllowed(
      {
        user: { public: false, roles: ['user'] },
        route: { path: '/api/offers' },
        method: 'GET',
      },
      res,
      () => {
        nextCalled = true;
      },
    );

    res.statusCode.should.equal(403);
    nextCalled.should.be.false();
    done();
  });

  it('allows owners to manipulate their own offer', done => {
    const { policy } = loadPolicy();
    const userId = { toString: () => 'user-id' };
    const req = {
      user: { _id: userId, public: true, roles: ['user'] },
      offer: { user: userId },
    };
    let nextCalled = false;

    policy.isAllowed(req, mockResponse(), () => {
      nextCalled = true;
    });

    nextCalled.should.be.true();
    done();
  });

  it('returns 500 when authorization fails unexpectedly', done => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(new Error('acl down'));
    const res = mockResponse();

    policy.isAllowed(
      {
        user: { public: true, roles: ['user'] },
        route: { path: '/api/offers' },
        method: 'GET',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(500);
    res.body.message.should.equal('Unexpected authorization error');
    done();
  });

  it('returns 403 JSON when the user is not allowed', done => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, false);
    const res = mockResponse();

    policy.isAllowed(
      {
        user: { public: true, roles: ['user'] },
        route: { path: '/api/offers' },
        method: 'DELETE',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(403);
    res.body.message.should.equal('Forbidden.');
    done();
  });
});
