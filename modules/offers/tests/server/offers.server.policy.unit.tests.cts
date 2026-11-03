let policyModule: typeof import('../../server/policies/offers.server.policy.mts');
before(async function () {
  policyModule = await import('../../server/policies/offers.server.policy.mts');
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

describe('Offers policy unit tests', () => {
  afterEach(() => sinon.restore());

  it('registers admin and user offer policies', () => {
    const { policy, mockAcl } = loadPolicy();

    policy.invokeRolesPolicies();

    mockAcl.allow.calledOnce.should.be.true();
    const policies = mockAcl.allow.firstCall.args[0];
    policies[0].roles.should.deepEqual(['admin']);
    policies[0].allows[0].permissions.should.equal('*');
    policies[1].roles.should.deepEqual(['user']);
    policies[1].allows
      .map((allow: { resources: string }) => allow.resources)
      .should.containEql('/api/offers-by/:offerUserId');
  });

  it('returns 403 for unauthenticated users', () => {
    const { policy } = loadPolicy();
    const res = mockResponse();

    policy.isAllowed(
      {
        route: { path: '/api/offers' },
        method: 'GET',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(403);
    res.body!.message.should.equal('Forbidden.');
  });

  it('returns 403 for unpublished users', done => {
    const { policy } = loadPolicy();
    const res = mockResponse();
    let nextCalled = false;

    policy.isAllowed(
      {
        user: {
          _id: { valueOf: () => 'user-id' },
          public: false,
          roles: ['user'],
        },
        route: { path: '/api/offers' },
        method: 'GET',
      },
      res,
      () => {
        nextCalled = true;
      },
    );

    res.statusCode.should.equal(403);
    nextCalled.should.be.false();
    done();
  });

  it('allows owners to manipulate their own offer', done => {
    const { policy } = loadPolicy();
    const userId = { toString: () => 'user-id' };
    const req = {
      user: { _id: userId, public: true, roles: ['user'] },
      route: { path: '/api/offer/:offerId' },
      method: 'PUT',
      offer: { user: userId },
    };
    let nextCalled = false;

    policy.isAllowed(req, mockResponse(), () => {
      nextCalled = true;
    });

    nextCalled.should.be.true();
    done();
  });

  it('calls next when ACL allows the request', () => {
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
        route: { path: '/api/offers-by/:offerUserId' },
        method: 'GET',
      },
      mockResponse(),
      next,
    );

    mockAcl.areAnyRolesAllowed
      .calledWith(['user'], '/api/offers-by/:offerUserId', 'get')
      .should.be.true();
    next.calledOnce.should.be.true();
  });
});
