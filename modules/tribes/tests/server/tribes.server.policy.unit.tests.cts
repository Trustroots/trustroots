let policyModule: typeof import('../../server/policies/tribes.server.policy.mts');
before(async function () {
  policyModule = await import('../../server/policies/tribes.server.policy.mts');
});
const sinon: typeof import('sinon') = require('sinon');
require('should');
interface PolicyResponseDouble {
  statusCode: number;
  body: { message: string } | null;
  status(code: number): PolicyResponseDouble;
  json(body: { message: string }): PolicyResponseDouble;
  send(body: { message: string }): PolicyResponseDouble;
}

function loadPolicy() {
  const implementation = policyModule;
  const mockAcl = implementation._acl;
  const allow = sinon.stub(mockAcl, 'allow');
  const areAnyRolesAllowed = sinon.stub(mockAcl, 'areAnyRolesAllowed');
  return {
    policy: implementation.default,
    mockAcl: { allow, areAnyRolesAllowed },
  };
}

function mockResponse(): PolicyResponseDouble {
  const res: PolicyResponseDouble = {
    statusCode: 200,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: { message: string }) {
      res.body = body;
      return res;
    },
    send(body: { message: string }) {
      res.body = body;
      return res;
    },
  };
  return res;
}

describe('Tribes policy unit tests', () => {
  afterEach(() => sinon.restore());

  it('registers admin, user, and guest tribe policies', () => {
    const { policy, mockAcl } = loadPolicy();

    policy.invokeRolesPolicies();

    mockAcl.allow.calledOnce.should.be.true();
    const policies = mockAcl.allow.firstCall.args[0];
    policies
      .map(entry => entry.roles[0])
      .should.deepEqual(['admin', 'user', 'guest']);
    policies[2].allows
      .map((allow: { resources: string }) => allow.resources)
      .should.deepEqual(['/api/tribes', '/api/tribes/:tribe']);
  });

  it('returns 500 when authorization fails unexpectedly', done => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(new Error('acl down'));
    const res = mockResponse();

    policy.isAllowed(
      {
        user: {
          _id: { valueOf: () => 'user-id' },
          public: true,
          roles: ['user'],
        },
        route: { path: '/api/tribes' },
        method: 'GET',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(500);
    res.body!.message.should.equal('Unexpected authorization error');
    done();
  });

  it('returns 403 JSON when the user is not allowed', done => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, false);
    const res = mockResponse();

    policy.isAllowed(
      {
        user: {
          _id: { valueOf: () => 'user-id' },
          public: true,
          roles: ['guest'],
        },
        route: { path: '/api/tribes' },
        method: 'DELETE',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(403);
    res.body!.message.should.equal('Forbidden.');
    done();
  });

  it('allows guests to read tribes', done => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, true);
    let nextCalled = false;

    policy.isAllowed(
      {
        route: { path: '/api/tribes' },
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

  it('uses signed-in user roles for ACL checks', () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, true);
    const next = sinon.stub();

    policy.isAllowed(
      {
        user: {
          _id: { valueOf: () => 'user-id' },
          roles: ['admin'],
          mfaEnabled: true,
          $locals: { mfaVerified: true },
        },
        route: { path: '/api/tribes/:tribe' },
        method: 'GET',
      },
      mockResponse(),
      next,
    );

    mockAcl.areAnyRolesAllowed
      .calledWith(['admin'], '/api/tribes/:tribe', 'get')
      .should.be.true();
    next.calledOnce.should.be.true();
  });

  it('keeps active circle-member listings private to signed-in roles', () => {
    const { policy, mockAcl } = loadPolicy();
    policy.invokeRolesPolicies();

    const policies = mockAcl.allow.firstCall.args[0];
    policies[0].allows
      .map((allow: { resources: string }) => allow.resources)
      .should.containEql('/api/tribes/:tribe/members');
    policies[1].allows
      .map((allow: { resources: string }) => allow.resources)
      .should.containEql('/api/tribes/:tribe/members');
    policies[2].allows
      .map((allow: { resources: string }) => allow.resources)
      .should.not.containEql('/api/tribes/:tribe/members');
  });
});
