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
  it('registers admin and user reference policies', () => {
    const { policy, mockAcl } = loadPolicy();

    policy.invokeRolesPolicies();

    mockAcl.allow.calledOnce.should.be.true();
    const policies = mockAcl.allow.firstCall.args[0];
    policies[0].roles.should.deepEqual(['admin']);
    policies[1].roles.should.deepEqual(['user']);
    policies[1].allows
      .map(allow => allow.resources)
      .should.containEql('/api/references-thread/:referenceThreadUserToId');
  });

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

  it('allows published users to read through ACL', () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, true);
    const next = sinon.stub();

    policy.isAllowed(
      {
        user: { public: true, roles: ['user'] },
        route: { path: '/api/references-thread/:referenceThreadUserToId' },
        method: 'GET',
      },
      mockResponse(),
      next,
    );

    mockAcl.areAnyRolesAllowed
      .calledWith(
        ['user'],
        '/api/references-thread/:referenceThreadUserToId',
        'get',
      )
      .should.be.true();
    next.calledOnce.should.be.true();
  });

  it('lets unpublished users read through ACL when not owning the thread', () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, true);
    const next = sinon.stub();

    policy.isAllowed(
      {
        user: {
          _id: 'reader-id',
          public: false,
          roles: ['user'],
        },
        referenceThread: { userFrom: { equals: sinon.stub().returns(false) } },
        route: { path: '/api/references-thread/:referenceThreadUserToId' },
        method: 'GET',
      },
      mockResponse(),
      next,
    );

    mockAcl.areAnyRolesAllowed.calledOnce.should.be.true();
    next.calledOnce.should.be.true();
  });

  it('checks guest permissions for signed-in users without roles', () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, false);

    policy.isAllowed(
      {
        user: { public: true },
        route: { path: '/api/references-thread' },
        method: 'POST',
      },
      mockResponse(),
      () => {},
    );

    mockAcl.areAnyRolesAllowed.firstCall.args[0].should.deepEqual(['guest']);
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
