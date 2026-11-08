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
        { resources: '/api/admin/acquisition-stories', permissions: ['post'] },
        {
          resources:
            '/api/admin/acquisition-stories/:memberId/resend-confirmation',
          permissions: ['post'],
        },
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
      .should.containEql('/api/admin/hackerspaces/signer');
    policies[0].allows
      .map(allow => allow.resources)
      .should.containEql('/api/admin/acquisition-stories');
    policies[0].allows
      .map(allow => allow.resources)
      .should.containEql(
        '/api/admin/acquisition-stories/:memberId/resend-confirmation',
      );
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

  it('limits Experience change operations to administrators and support', async () => {
    const policy =
      await import('../../server/policies/admin.server.policy.mts');
    policy.invokeRolesPolicies();
    const operations = [
      ['/api/admin/experiences', 'GET'],
      ['/api/admin/experiences/:id/change-links', 'POST'],
      ['/api/admin/experience-change-requests', 'GET'],
      ['/api/admin/experience-change-requests/:id/decision', 'POST'],
    ];
    for (const role of [
      'admin',
      'support-team',
      'welcome-team',
      'user',
      'guest',
    ]) {
      for (const [path, method] of operations) {
        const req = policyRequest([role]);
        req.route.path = path;
        req.method = method;
        const res = mockResponse();
        const next = sinon.stub();
        policy.isAllowed(req, res, next);
        next.calledOnce.should.equal(['admin', 'support-team'].includes(role));
        if (!next.called) res.statusCode.should.equal(403);
      }
    }
  });

  describe('grants per role', () => {
    const supportAndAdmin = [
      'get /api/admin/experiences',
      'post /api/admin/experiences/:id/change-links',
      'get /api/admin/experience-change-requests',
      'post /api/admin/experience-change-requests/:id/decision',
      'get /api/admin/support',
      'get /api/admin/support/:requestId',
      'patch /api/admin/support/:requestId',
      'get /api/admin/support/:requestId/conversation',
      'post /api/admin/support/:requestId/replies',
      'post /api/admin/support/:requestId/replies/:messageId/retry',
      'get /api/admin/support/:requestId/:kind',
      'get /api/admin/support-members',
      'get /api/admin/support-flagged-members',
      'patch /api/admin/support-members/:memberId/flag',
      'get /api/admin/support-members/:memberId',
      'get /api/admin/notes',
      'post /api/admin/notes',
    ];
    const welcomeAndSupport = [
      'post /api/admin/acquisition-stories',
      'post /api/admin/acquisition-stories/:memberId/resend-confirmation',
      'get /api/admin/location-corrections',
      'post /api/admin/location-corrections/send',
      'get /api/admin/staff-blockers',
    ];
    const adminOnly = [
      'get /api/admin/signup-review-rules',
      'put /api/admin/signup-review-rules',
      'post /api/admin/spam-cleanup/preview',
      'post /api/admin/spam-cleanup/apply',
      'post /api/admin/support-import/preview',
      'post /api/admin/support-import/apply',
      'get /api/admin/circles',
      'post /api/admin/circles',
      'get /api/admin/circles/:circle',
      'put /api/admin/circles/:circle',
      'get /api/admin/hackerspaces/preview',
      'get /api/admin/hackerspaces/signer',
      'get /api/admin/audit-log',
      'get /api/admin/audit-log/actors',
      'get /api/admin/username-changes',
      'get /api/admin/gravatar',
      'get /api/admin/dashboard',
      'post /api/admin/messages',
      'post /api/admin/messages/scammer-recipients',
      'post /api/admin/messages/scammer-warning',
      'post /api/admin/threads',
      'post /api/admin/user',
      'post /api/admin/user/unsuspend',
      'post /api/admin/user/delete',
      'post /api/admin/user/change-role',
      'post /api/admin/users',
      'post /api/admin/users/by-role',
      'post /api/admin/users/by-last-ip-hash',
      'get /api/admin/reference-threads',
      'get /api/admin/sparkpost/recovery',
      'post /api/admin/sparkpost/recovery',
      'get /api/admin/sparkpost/:action',
      'get /api/admin/newsletter-subscribers',
      'get /api/admin/newsletter-subscribers/circle',
      'post /api/admin/newsletter-subscribers/audience',
      'post /api/admin/newsletter-subscribers/split',
    ];
    const expected: Record<string, string[]> = {
      admin: [...supportAndAdmin, ...welcomeAndSupport, ...adminOnly],
      'support-team': [...supportAndAdmin, ...welcomeAndSupport],
      'welcome-team': welcomeAndSupport,
      user: [],
      guest: [],
    };
    const paths = [
      ...new Set(
        [...supportAndAdmin, ...welcomeAndSupport, ...adminOnly].map(
          grant => grant.split(' ')[1],
        ),
      ),
    ];
    const methods = ['get', 'post', 'put', 'patch', 'delete'];

    for (const [role, grants] of Object.entries(expected)) {
      it(`lets ${role} reach exactly its admin routes`, () => {
        // A fresh copy builds its exports under this test, with its own ACL.
        const policyPath =
          require.resolve('../../server/policies/admin.server.policy.mts');
        delete require.cache[policyPath];
        // require() returns the CommonJS interop object.
        const policy: PolicyModule['default'] = require(policyPath);
        policy.invokeRolesPolicies();
        const allowed: string[] = [];
        for (const path of paths) {
          for (const method of methods) {
            const req = policyRequest(role === 'guest' ? undefined : [role]);
            req.route.path = path;
            req.method = method.toUpperCase();
            const res = mockResponse();
            const next = sinon.stub();
            policy.isAllowed(req, res, next);
            if (next.calledOnce) {
              allowed.push(`${method} ${path}`);
            } else {
              res.statusCode.should.equal(403);
              res.body!.message.should.equal('Forbidden.');
            }
          }
        }
        allowed.sort().should.deepEqual([...grants].sort());
      });
    }
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
