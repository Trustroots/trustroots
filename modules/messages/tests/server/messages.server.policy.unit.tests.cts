let policyModule: typeof import('../../server/policies/messages.server.policy.mts');
before(async function () {
  policyModule =
    await import('../../server/policies/messages.server.policy.mts');
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

describe('Messages policy unit tests', () => {
  afterEach(() => sinon.restore());

  it('registers admin and user message policies', () => {
    const { policy, mockAcl } = loadPolicy();

    policy.invokeRolesPolicies();

    mockAcl.allow.calledOnce.should.be.true();
    const policies = mockAcl.allow.firstCall.args[0];
    policies[0].roles.should.deepEqual(['admin']);
    policies[1].roles.should.deepEqual(['user']);
    policies[1].allows
      .map((allow: { resources: string }) => allow.resources)
      .should.containEql('/api/messages-sync');
  });

  it('grants exactly the documented permissions per role', () => {
    const { policy, mockAcl } = loadPolicy();

    policy.invokeRolesPolicies();

    mockAcl.allow.firstCall.args[0].should.deepEqual([
      {
        roles: ['admin'],
        allows: [
          { resources: '/api/messages', permissions: [] },
          { resources: '/api/messages/:messageUserId', permissions: [] },
          { resources: '/api/messages-preview', permissions: ['post'] },
          { resources: '/api/messages-read', permissions: [] },
          { resources: '/api/messages-count', permissions: [] },
          { resources: '/api/messages-sync', permissions: [] },
        ],
      },
      {
        roles: ['user'],
        allows: [
          { resources: '/api/messages', permissions: ['get', 'post'] },
          { resources: '/api/messages/:messageUserId', permissions: ['get'] },
          { resources: '/api/messages-preview', permissions: ['post'] },
          { resources: '/api/messages-read', permissions: ['post'] },
          { resources: '/api/messages-count', permissions: ['get'] },
          { resources: '/api/messages-sync', permissions: ['get'] },
        ],
      },
    ]);
  });

  it('calls next when ACL allows a public user', () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, true);
    const next = sinon.stub();

    policy.isAllowed(
      {
        user: {
          _id: { valueOf: () => 'user-id' },
          public: true,
          roles: ['user'],
        },
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

  it('blocks non-public signed-in users before ACL', () => {
    const { policy } = loadPolicy();
    const res = mockResponse();

    policy.isAllowed(
      {
        user: {
          _id: { valueOf: () => 'user-id' },
          public: false,
          roles: ['user'],
        },
        route: { path: '/api/messages' },
        method: 'GET',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(403);
    res.body!.message.should.equal('Forbidden.');
  });
});
