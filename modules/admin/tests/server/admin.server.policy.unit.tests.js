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
  const policy = proxyquire('../../server/policies/admin.server.policy', {
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

describe('Admin policy unit tests', () => {
  it('registers admin-only role policies', () => {
    const { policy, mockAcl } = loadPolicy();

    policy.invokeRolesPolicies();

    mockAcl.allow.calledOnce.should.be.true();
    const policies = mockAcl.allow.firstCall.args[0];
    policies.length.should.equal(1);
    policies[0].roles.should.deepEqual(['admin']);
    policies[0].allows
      .map(allow => allow.resources)
      .should.containEql('/api/admin/acquisition-stories');
    policies[0].allows
      .map(allow => allow.resources)
      .should.containEql('/api/admin/reference-threads');
  });

  it('calls next when ACL allows the admin request', () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, true);
    const next = sinon.stub();

    policy.isAllowed(
      {
        user: { roles: ['admin'] },
        route: { path: '/api/admin/users' },
        method: 'POST',
      },
      mockResponse(),
      next,
    );

    mockAcl.areAnyRolesAllowed
      .calledWith(['admin'], '/api/admin/users', 'post')
      .should.be.true();
    next.calledOnce.should.be.true();
  });

  it('checks guest permissions when no user roles are present', () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, false);

    policy.isAllowed(
      {
        route: { path: '/api/admin/users' },
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
        user: { roles: ['admin'] },
        route: { path: '/api/admin/users' },
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
        user: { roles: ['user'] },
        route: { path: '/api/admin/users' },
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
