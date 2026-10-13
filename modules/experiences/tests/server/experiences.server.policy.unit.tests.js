let policyModule;
before(async function () {
  policyModule =
    await import('../../server/policies/experiences.server.policy.mts');
});
const sinon = require('sinon');
require('should');

function loadPolicy() {
  const implementation = policyModule;
  const mockAcl = implementation._acl;
  sinon.stub(mockAcl, 'allow');
  sinon.stub(mockAcl, 'areAnyRolesAllowed');
  return { policy: implementation.default, mockAcl };
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

describe('Experiences policy unit tests', () => {
  afterEach(() => sinon.restore());

  it('registers public user and admin experience policies', () => {
    const { policy, mockAcl } = loadPolicy();

    policy.invokeRolesPolicies();

    mockAcl.allow.calledOnce.should.be.true();
    const policies = mockAcl.allow.firstCall.args[0];
    policies.length.should.equal(1);
    policies[0].roles.should.deepEqual(['user', 'admin']);
    policies[0].allows
      .map(allow => allow.resources)
      .should.containEql('/api/my-experience');
    policies[0].allows
      .map(allow => allow.resources)
      .should.containEql('/api/experiences/suggestion');
  });

  it('calls next when ACL allows a public user', async () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.resolves(true);
    const next = sinon.stub();

    await policy.isAllowed(
      {
        user: { public: true, roles: ['user'] },
        route: { path: '/api/experiences' },
        method: 'POST',
      },
      mockResponse(),
      next,
    );

    mockAcl.areAnyRolesAllowed
      .calledWith(['user'], '/api/experiences', 'post')
      .should.be.true();
    next.calledOnce.should.be.true();
  });

  it('checks guest permissions when there is no signed-in user', async () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.resolves(false);

    await policy.isAllowed(
      {
        route: { path: '/api/experiences' },
        method: 'GET',
      },
      mockResponse(),
      () => {},
    );

    mockAcl.areAnyRolesAllowed.firstCall.args[0].should.deepEqual(['guest']);
  });

  it('passes thrown ACL errors to next', async () => {
    const { policy, mockAcl } = loadPolicy();
    const aclError = new Error('acl down');
    mockAcl.areAnyRolesAllowed.rejects(aclError);
    let nextArg;

    await policy.isAllowed(
      {
        user: { public: true, roles: ['user'] },
        route: { path: '/api/experiences' },
        method: 'GET',
      },
      mockResponse(),
      err => {
        nextArg = err;
      },
    );

    nextArg.should.equal(aclError);
  });

  it('returns 403 for non-public users', async () => {
    const { policy } = loadPolicy();
    const res = mockResponse();

    await policy.isAllowed(
      {
        user: { public: false, roles: ['user'] },
        route: { path: '/api/experiences' },
        method: 'GET',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(403);
    res.body.message.should.equal('Forbidden.');
  });

  it('returns 403 when ACL denies access', async () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.resolves(false);
    const res = mockResponse();

    await policy.isAllowed(
      {
        user: { public: true, roles: ['guest'] },
        route: { path: '/api/experiences' },
        method: 'POST',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(403);
    res.body.message.should.equal('Forbidden.');
  });

  it('allows signed-in users whose change-request route is permitted', async () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.resolves(true);
    const next = sinon.stub();

    await policy.isAllowedChange(
      {
        user: { roles: ['user'] },
        route: { path: '/api/experiences/:id/change-requests/mine' },
        method: 'GET',
      },
      mockResponse(),
      next,
    );

    mockAcl.areAnyRolesAllowed
      .calledWith(['user'], '/api/experiences/:id/change-requests/mine', 'get')
      .should.be.true();
    next.calledOnce.should.be.true();
  });

  it('denies guests and signed-in users when change-request access is not allowed', async () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.resolves(false);
    const response = mockResponse();

    await policy.isAllowedChange(
      {
        route: { path: '/api/experiences/:id/change-requests/mine' },
        method: 'GET',
      },
      response,
      () => {},
    );

    response.statusCode.should.equal(403);
    mockAcl.areAnyRolesAllowed.called.should.be.false();

    await policy.isAllowedChange(
      {
        user: { roles: ['user'] },
        route: { path: '/api/experiences/:id/change-requests/mine' },
        method: 'GET',
      },
      response,
      () => {},
    );

    response.statusCode.should.equal(403);
  });

  it('passes change-request ACL errors to next', async () => {
    const { policy, mockAcl } = loadPolicy();
    const aclError = new Error('acl down');
    mockAcl.areAnyRolesAllowed.rejects(aclError);
    let nextArg;

    await policy.isAllowedChange(
      {
        user: { roles: ['user'] },
        route: { path: '/api/experiences/:id/change-requests/mine' },
        method: 'GET',
      },
      mockResponse(),
      err => {
        nextArg = err;
      },
    );

    nextArg.should.equal(aclError);
  });
});
