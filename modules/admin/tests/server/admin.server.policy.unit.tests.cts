const sinon: typeof import('sinon') = require('sinon');
require('should');

type PolicyModule =
  typeof import('../../server/policies/admin.server.policy.mts');
type AdminRequest = Parameters<PolicyModule['isAllowed']>[0];
type MockPolicyResponse = {
  statusCode: number;
  body: { message: string } | null;
  status(code: number): MockPolicyResponse;
  send(body: { message: string }): MockPolicyResponse;
  json(body: { message: string }): MockPolicyResponse;
};

async function loadPolicy() {
  const policy = await import('../../server/policies/admin.server.policy.mts');
  const mockAcl = policy._acl;
  const allow = sinon.stub(mockAcl, 'allow');
  const areAnyRolesAllowed = sinon.stub(mockAcl, 'areAnyRolesAllowed');
  return { policy, mockAcl, allow, areAnyRolesAllowed };
}

function policyRequest(roles?: string[]): AdminRequest {
  return {
    ...(roles && { user: { roles, _id: { valueOf: () => 'test-user-id' } } }),
    route: { path: '/api/admin/users' },
    method: 'POST',
  };
}

function mockResponse(): MockPolicyResponse {
  const res: MockPolicyResponse = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(body) {
      res.body = body;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

describe('Admin policy unit tests', () => {
  afterEach(() => sinon.restore());
  it('registers separate support, greeter and administrator policies', async () => {
    const { policy, allow } = await loadPolicy();

    policy.invokeRolesPolicies();

    allow.calledOnce.should.be.true();
    const policies = allow.firstCall.args[0];
    policies.length.should.equal(3);
    const support = policies.shift();
    if (!support) throw new Error('Expected the support policy');
    support.roles.should.deepEqual(['admin', 'support-team']);
    support.allows
      .map(allow => allow.resources)
      .should.containEql('/api/admin/support/:requestId/:kind');
    const welcome = policies.shift();
    if (!welcome) throw new Error('Expected the welcome policy');
    welcome.roles.should.deepEqual(['welcome-team', 'support-team']);
    welcome.allows
      .sort((a, b) => a.resources.localeCompare(b.resources))
      .should.deepEqual([
        { resources: '/api/admin/elevate', permissions: ['post'] },
        { resources: '/api/admin/acquisition-stories', permissions: ['post'] },
        { resources: '/api/admin/location-corrections', permissions: ['get'] },
        {
          resources: '/api/admin/location-corrections/send',
          permissions: ['post'],
        },
        { resources: '/api/admin/staff-blockers', permissions: ['get'] },
      ]);
    policies[0].roles.should.deepEqual(['admin']);
    policies[0].allows
      .map(allow => allow.resources)
      .should.containEql('/api/admin/elevate');
    policies[0].allows
      .map(allow => allow.resources)
      .should.containEql('/api/admin/acquisition-stories');
    policies[0].allows
      .map(allow => allow.resources)
      .should.containEql('/api/admin/staff-blockers');
    policies[0].allows
      .map(allow => allow.resources)
      .should.containEql('/api/admin/dashboard');
    policies[0].allows
      .map(allow => allow.resources)
      .should.containEql('/api/admin/reference-threads');
    policies[0].allows
      .map(allow => allow.resources)
      .should.containEql('/api/admin/newsletter-subscribers/audience');
    policies[0].allows
      .map(allow => allow.resources)
      .should.containEql('/api/admin/newsletter-subscribers');
    policies[0].allows
      .map(allow => allow.resources)
      .should.containEql('/api/admin/newsletter-subscribers/circle');
    policies[0].allows
      .map(allow => allow.resources)
      .should.containEql('/api/admin/newsletter-subscribers/split');
  });

  it('calls next when ACL allows the admin request', async () => {
    const { policy, areAnyRolesAllowed } = await loadPolicy();
    areAnyRolesAllowed.yields(null, true);
    const next = sinon.stub();

    policy.isAllowed(policyRequest(['admin']), mockResponse(), next);

    areAnyRolesAllowed
      .calledWith(['admin'], '/api/admin/users', 'post')
      .should.be.true();
    next.calledOnce.should.be.true();
  });

  it('checks guest permissions when no user roles are present', async () => {
    const { policy, areAnyRolesAllowed } = await loadPolicy();
    areAnyRolesAllowed.yields(null, false);

    policy.isAllowed(policyRequest(), mockResponse(), () => {});

    areAnyRolesAllowed.firstCall.args[0].should.deepEqual(['guest']);
  });

  it('returns 500 when authorization fails unexpectedly', async () => {
    const { policy, areAnyRolesAllowed } = await loadPolicy();
    areAnyRolesAllowed.yields(new Error('acl down'));
    const res = mockResponse();

    policy.isAllowed(policyRequest(['admin']), res, () => {});

    res.statusCode.should.equal(500);
    res.body!.message.should.equal('Unexpected authorization error');
  });

  it('returns 403 JSON when the user is not allowed', async () => {
    const { policy, areAnyRolesAllowed } = await loadPolicy();
    areAnyRolesAllowed.yields(null, false);
    const res = mockResponse();

    policy.isAllowed(policyRequest(['user']), res, () => {});

    res.statusCode.should.equal(403);
    res.body!.message.should.equal('Forbidden.');
  });
});
