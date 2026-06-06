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
  const policy = proxyquire('../../server/policies/messages.server.policy', {
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
  res.json = body => {
    res.body = body;
    return res;
  };
  return res;
}

describe('Messages policy unit tests', () => {
  it('registers admin and user message policies', () => {
    const { policy, mockAcl } = loadPolicy();

    policy.invokeRolesPolicies();

    mockAcl.allow.calledOnce.should.be.true();
    const policies = mockAcl.allow.firstCall.args[0];
    policies[0].roles.should.deepEqual(['admin']);
    policies[1].roles.should.deepEqual(['user']);
    policies[1].allows
      .map(allow => allow.resources)
      .should.containEql('/api/messages-sync');
  });

  it('calls next when ACL allows a public user', () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, true);
    const next = sinon.stub();

    policy.isAllowed(
      {
        user: { public: true, roles: ['user'] },
        route: { path: '/api/messages' },
        method: 'POST',
      },
      mockResponse(),
      next,
    );

    mockAcl.areAnyRolesAllowed
      .calledWith(['user'], '/api/messages', 'post')
      .should.be.true();
    next.calledOnce.should.be.true();
  });

  it('checks guest permissions when there is no signed-in user', () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, false);

    policy.isAllowed(
      {
        route: { path: '/api/messages' },
        method: 'GET',
      },
      mockResponse(),
      () => {},
    );

    mockAcl.areAnyRolesAllowed.firstCall.args[0].should.deepEqual(['guest']);
  });

  it('blocks non-public signed-in users before ACL', () => {
    const { policy } = loadPolicy();
    const res = mockResponse();

    policy.isAllowed(
      { user: { public: false, roles: ['user'] }, route: {}, method: 'GET' },
      res,
      () => {},
    );

    res.statusCode.should.equal(403);
    res.body.message.should.equal('Forbidden.');
  });

  it('returns 500 when authorization fails unexpectedly', done => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(new Error('acl down'));
    const res = mockResponse();

    policy.isAllowed(
      {
        user: { public: true, roles: ['user'] },
        route: { path: '/api/messages' },
        method: 'GET',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(500);
    res.body.message.should.equal('Unexpected authorization error');
    done();
  });

  it('returns 403 JSON when ACL denies access', () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, false);
    const res = mockResponse();

    policy.isAllowed(
      {
        user: { public: true, roles: ['user'] },
        route: { path: '/api/messages-read' },
        method: 'DELETE',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(403);
    res.body.message.should.equal('Forbidden.');
  });
});
