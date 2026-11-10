import type {
  PolicyResponse,
  PolicyRule,
} from '../../../../modules/core/server/services/policy-types.server.mts';

let policyModule: typeof import('../../server/policies/users.server.policy.mts');
before(async function () {
  policyModule =
    await import('./../../server/policies/users.server.policy.mts');
});
const sinon: typeof import('sinon') = require('sinon');
require('should');

function loadPolicy() {
  const mockAcl = {
    allow: sinon.stub<[PolicyRule[]], void>(),
    areAnyRolesAllowed: sinon.stub<
      [
        string[],
        string,
        string,
        (error: Error | null, allowed: boolean) => void,
      ],
      void
    >(),
  };
  const policy: typeof import('../../server/policies/users.server.policy.mts') = require('./../../server/policies/users.server.policy.mts');
  const { _acl } = policyModule;
  sinon.stub(_acl, 'allow').callsFake(mockAcl.allow);
  sinon
    .stub(_acl, 'areAnyRolesAllowed')
    .callsFake(
      mockAcl.areAnyRolesAllowed as unknown as typeof _acl.areAnyRolesAllowed,
    );
  return { policy, mockAcl };
}

interface MockPolicyResponse extends PolicyResponse {
  statusCode: number;
  body: unknown;
}

function mockResponse(): MockPolicyResponse {
  const res: MockPolicyResponse = {
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

function messageBody(response: MockPolicyResponse): string {
  if (
    typeof response.body !== 'object' ||
    response.body === null ||
    !('message' in response.body) ||
    typeof response.body.message !== 'string'
  ) {
    throw new Error('Expected a policy message');
  }
  return response.body.message;
}

const noProfileUserId = { valueOf: () => 'anonymous-test-user' };

describe('Users policy unit tests', () => {
  afterEach(() => sinon.restore());

  const grants: [string, string[]][] = [
    ['/api/users', ['get', 'put', 'delete']],
    ['/api/users/export', ['get']],
    ['/api/users/removal/pending', ['get', 'delete']],
    ['/api/users/remove/:token', ['delete']],
    ['/api/users/:username', ['get']],
    ['/api/users/:avatarUserId/avatar', ['get']],
    ['/api/users-avatar', ['post']],
    ['/api/users/mini/:userId', ['get']],
    ['/api/users/password', ['post']],
    ['/api/users/accounts/:provider', ['delete']],
    ['/api/users/memberships', ['get']],
    ['/api/users/memberships/:tribeId', ['post', 'delete']],
    ['/api/users/push/registrations', ['post']],
    ['/api/users/push/registrations/:token', ['delete']],
    ['/api/users/unified-push', ['get', 'post', 'delete']],
    ['/api/blocked-users', ['get']],
    ['/api/blocked-users/:username', ['put', 'delete']],
  ];

  // Assert inside a test: grants registered from a hook are credited to no
  // test, so their mutants would never run.
  it('registers the administrator profile read and member grants', () => {
    const { policy, mockAcl } = loadPolicy();
    policy.invokeRolesPolicies();
    mockAcl.allow.firstCall.args[0].should.deepEqual([
      {
        roles: ['admin'],
        allows: [
          '/api/users',
          '/api/users/:username',
          '/api/users/avatar',
          '/api/users/mini/:userId',
          '/api/users/password',
          '/api/users/accounts/:provider',
          '/api/users/memberships',
          '/api/users/memberships/:tribeId',
        ].map(resources => ({
          resources,
          permissions: resources === '/api/users/:username' ? ['get'] : [],
        })),
      },
      {
        roles: ['user'],
        allows: grants.map(([resources, permissions]) => ({
          resources,
          permissions,
        })),
      },
    ]);
  });

  describe('grants for signed-in users', () => {
    const decide = (roles: string[], path: string, method: string) => {
      const res = mockResponse();
      let status = 0;
      policyModule.isAllowed(
        {
          user: { _id: noProfileUserId, public: true, roles },
          route: { path },
          method,
        },
        res,
        () => (status = 200),
      );
      return status || res.statusCode;
    };
    before(() => policyModule.invokeRolesPolicies());

    for (const [path, allowed] of grants) {
      it(`${path} allows exactly ${allowed.join(', ')}`, () => {
        for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
          const expected = allowed.includes(method.toLowerCase()) ? 200 : 403;
          decide(['user'], path, method).should.equal(expected);
          const adminExpected =
            path === '/api/users/:username' && method === 'GET' ? 200 : 403;
          decide(['admin'], path, method).should.equal(adminExpected);
        }
      });
    }
  });

  it('calls next when ACL allows the request', () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, true);
    const next = sinon.stub();

    policy.isAllowed(
      {
        user: { _id: noProfileUserId, public: true, roles: ['user'] },
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

  it('refuses unauthenticated member data exports', () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, false);
    const response = mockResponse();

    policy.isAllowed(
      {
        route: { path: '/api/users/export' },
        method: 'GET',
      },
      response,
      () => {},
    );

    response.statusCode.should.equal(403);
    messageBody(response).should.equal('Forbidden.');
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
        user: { _id: noProfileUserId, public: true, roles: ['user'] },
        route: { path: '/api/users/:username' },
        method: 'GET',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(500);
    messageBody(res).should.equal('Unexpected authorization error');
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
    messageBody(res).should.equal('Not found.');
    done();
  });

  it('checks administrator authorisation for a hidden profile read', () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, true);
    const next = sinon.stub();

    policy.isAllowed(
      {
        user: { _id: noProfileUserId, public: false, roles: ['admin'] },
        profile: { _id: { equals: () => false }, public: false },
        route: { path: '/api/users/:username' },
        method: 'GET',
      },
      mockResponse(),
      next,
    );

    mockAcl.areAnyRolesAllowed
      .calledWith(['admin'], '/api/users/:username', 'get')
      .should.be.true();
    next.calledOnce.should.be.true();
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
    messageBody(res).should.equal('Forbidden.');
    done();
  });

  it('returns 403 JSON when the user is not allowed', done => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, false);
    const res = mockResponse();

    policy.isAllowed(
      {
        user: { _id: noProfileUserId, public: true, roles: ['guest'] },
        route: { path: '/api/users/:username' },
        method: 'PUT',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(403);
    messageBody(res).should.equal('Forbidden.');
    done();
  });
});
