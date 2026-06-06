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
  const policy = proxyquire(
    '../../server/policies/reference-thread.server.policy',
    {
      acl: AclConstructor,
    },
  );
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

describe('Reference thread policy unit tests', () => {
  it('returns 403 for unauthenticated users', done => {
    const { policy } = loadPolicy();
    const res = mockResponse();

    policy.isAllowed(
      {
        route: { path: '/api/references-thread' },
        method: 'POST',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(403);
    done();
  });

  it('returns 403 for unpublished users creating references', done => {
    const { policy } = loadPolicy();
    const res = mockResponse();

    policy.isAllowed(
      {
        user: { public: false, roles: ['user'] },
        route: { path: '/api/references-thread' },
        method: 'POST',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(403);
    done();
  });

  it('allows unpublished users to read their own reference thread', done => {
    const { policy } = loadPolicy();
    const userId = { equals: () => true };
    let nextCalled = false;

    policy.isAllowed(
      {
        user: { _id: userId, public: false, roles: ['user'] },
        referenceThread: { userFrom: userId },
        route: { path: '/api/references-thread/:referenceThreadUserToId' },
        method: 'GET',
      },
      mockResponse(),
      () => {
        nextCalled = true;
      },
    );

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
        route: { path: '/api/references-thread' },
        method: 'POST',
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
        user: { public: true, roles: ['guest'] },
        route: { path: '/api/references-thread' },
        method: 'POST',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(403);
    res.body.message.should.equal('Forbidden.');
    done();
  });
});
