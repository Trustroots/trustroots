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
  const policy = proxyquire('../../server/policies/users.server.policy', {
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

describe('Users policy unit tests', () => {
  it('registers user and admin role policies', () => {
    const { policy, mockAcl } = loadPolicy();

    policy.invokeRolesPolicies();

    mockAcl.allow.calledOnce.should.be.true();
    const policies = mockAcl.allow.firstCall.args[0];
    policies[0].roles.should.deepEqual(['admin']);
    policies[1].roles.should.deepEqual(['user']);
    policies[1].allows
      .map(allow => allow.resources)
      .should.containEql('/api/users/push/registrations/:token');
  });

  it('calls next when ACL allows the request', () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, true);
    const next = sinon.stub();

    policy.isAllowed(
      {
        user: { public: true, roles: ['user'] },
        route: { path: '/api/users/:username' },
        method: 'GET',
      },
      mockResponse(),
      next,
    );

    mockAcl.areAnyRolesAllowed
      .calledWith(['user'], '/api/users/:username', 'get')
      .should.be.true();
    next.calledOnce.should.be.true();
  });

  it('checks guest permissions when there is no signed-in user', () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, false);

    policy.isAllowed(
      {
        route: { path: '/api/users/:username' },
        method: 'GET',
      },
      mockResponse(),
      () => {},
    );

    mockAcl.areAnyRolesAllowed.firstCall.args[0].should.deepEqual(['guest']);
  });

  it('allows profile owners past public-profile prechecks', () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, true);
    const next = sinon.stub();
    const ownId = { equals: sinon.stub().returns(true) };

    policy.isAllowed(
      {
        user: { _id: ownId, public: false, roles: ['user'] },
        profile: { _id: ownId, public: false },
        route: { path: '/api/users/:username' },
        method: 'GET',
      },
      mockResponse(),
      next,
    );

    next.calledOnce.should.be.true();
  });

  it('returns 500 when authorization fails unexpectedly', done => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(new Error('acl down'));
    const res = mockResponse();

    policy.isAllowed(
      {
        user: { public: true, roles: ['user'] },
        route: { path: '/api/users/:username' },
        method: 'GET',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(500);
    res.body.message.should.equal('Unexpected authorization error');
    done();
  });

  it('returns 404 for hidden profiles viewed by another user', done => {
    const { policy } = loadPolicy();
    const profileId = { equals: () => false };
    const res = mockResponse();

    policy.isAllowed(
      {
        user: { _id: { equals: () => true }, public: true, roles: ['user'] },
        profile: { _id: profileId, public: false },
        route: { path: '/api/users/:username' },
        method: 'GET',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(404);
    res.body.message.should.equal('Not found.');
    done();
  });

  it('returns 403 when a non-public user browses another profile', done => {
    const { policy } = loadPolicy();
    const profileId = { equals: () => false };
    const res = mockResponse();

    policy.isAllowed(
      {
        user: { _id: { equals: () => true }, public: false, roles: ['user'] },
        profile: { _id: profileId, public: true },
        route: { path: '/api/users/:username' },
        method: 'GET',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(403);
    res.body.message.should.equal('Forbidden.');
    done();
  });

  it('returns 403 JSON when the user is not allowed', done => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, false);
    const res = mockResponse();

    policy.isAllowed(
      {
        user: { public: true, roles: ['guest'] },
        route: { path: '/api/users/:username' },
        method: 'PUT',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(403);
    res.body.message.should.equal('Forbidden.');
    done();
  });
});
