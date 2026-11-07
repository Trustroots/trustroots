let policyModule: typeof import('../../server/policies/reference-thread.server.policy.mts');
before(async function () {
  policyModule =
    await import('../../server/policies/reference-thread.server.policy.mts');
});
const sinon: typeof import('sinon') = require('sinon');
const proxyquire: typeof import('../../../../testutils/server/mock-module.mts').default = require('../../../../testutils/server/mock-module');
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

describe('Reference thread policy unit tests', () => {
  afterEach(() => sinon.restore());

  it('registers admin and user reference policies', () => {
    const { policy, mockAcl } = loadPolicy();

    policy.invokeRolesPolicies();

    mockAcl.allow.calledOnce.should.be.true();
    const policies = mockAcl.allow.firstCall.args[0];
    policies[0].roles.should.deepEqual(['admin']);
    policies[1].roles.should.deepEqual(['user']);
    policies[1].allows
      .map((allow: { resources: string }) => allow.resources)
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
        user: {
          _id: { valueOf: () => 'user-id' },
          public: false,
          roles: ['user'],
        },
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
        user: {
          _id: { valueOf: () => 'user-id' },
          public: true,
          roles: ['user'],
        },
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

  it('checks guest permissions for signed-in users without roles', () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, false);

    policy.isAllowed(
      {
        user: { _id: { valueOf: () => 'user-id' }, public: true },
        route: { path: '/api/references-thread' },
        method: 'POST',
      },
      mockResponse(),
      () => {},
    );

    mockAcl.areAnyRolesAllowed.firstCall.args[0].should.deepEqual(['guest']);
  });

  describe('with the registered grants', () => {
    type Outcome = { nextCalled: boolean; statusCode: number };
    function check(roles: string[], path: string, method: string): Outcome {
      // Registering inside the test keeps the grants covered by this test.
      policyModule.default.invokeRolesPolicies();
      const res = mockResponse();
      let nextCalled = false;
      policyModule.default.isAllowed(
        { user: { _id: {}, public: true, roles }, route: { path }, method },
        res,
        () => {
          nextCalled = true;
        },
      );
      return { nextCalled, statusCode: res.statusCode };
    }

    for (const role of ['admin', 'user']) {
      it(`lets ${role} create and read references`, () => {
        check(
          [role],
          '/api/references-thread',
          'POST',
        ).nextCalled.should.be.true();
        check(
          [role],
          '/api/references-thread/:referenceThreadUserToId',
          'GET',
        ).nextCalled.should.be.true();
      });

      it(`keeps ${role} from other methods on reference routes`, () => {
        check([role], '/api/references-thread', 'GET').should.eql({
          nextCalled: false,
          statusCode: 403,
        });
        check(
          [role],
          '/api/references-thread/:referenceThreadUserToId',
          'POST',
        ).should.eql({ nextCalled: false, statusCode: 403 });
        check(
          [role],
          '/api/references-thread',
          'DELETE',
        ).statusCode.should.equal(403);
      });
    }

    it('denies roles without grants', () => {
      check(['guest'], '/api/references-thread', 'POST').should.eql({
        nextCalled: false,
        statusCode: 403,
      });
    });
  });

  it('sends the unexpected authorization error as a 500 message', () => {
    // A fresh copy of the policy, so its route authorisation is built in this test.
    const freshPolicy = proxyquire<typeof policyModule.default>(
      require.resolve('../../server/policies/reference-thread.server.policy.mts'),
      {
        './../../../core/server/services/memory-policy.server.service.mts':
          () => ({
            allow() {},
            areAnyRolesAllowed(
              _roles: string[],
              _resource: string,
              _permission: string,
              callback: (error: Error | null, allowed?: boolean) => void,
            ) {
              return callback(new Error('acl down'));
            },
          }),
      },
    );
    const res = mockResponse();

    freshPolicy.isAllowed(
      {
        user: { _id: {}, public: true, roles: ['user'] },
        route: { path: '/api/references-thread' },
        method: 'POST',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(500);
    res.body!.should.eql({ message: 'Unexpected authorization error' });
  });
});
