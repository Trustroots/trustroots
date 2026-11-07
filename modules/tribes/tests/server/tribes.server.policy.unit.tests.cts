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

  // First in the file: module-level code is attributed to the first test, so
  // this one must exercise the error responder wired up at load time.
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

  describe('granted routes', () => {
    const decide = (
      role: string,
      path: string,
      method: string,
    ): Promise<number> => {
      const { policy } = {
        policy: policyModule.default,
      };
      policy.invokeRolesPolicies();
      return new Promise(resolve => {
        const res = mockResponse();
        policy.isAllowed(
          {
            user:
              role === 'guest'
                ? undefined
                : {
                    _id: { valueOf: () => 'user-id' },
                    public: true,
                    roles: [role],
                  },
            route: { path },
            method,
          },
          res,
          () => resolve(200),
        );
        if (res.statusCode !== 200) {
          resolve(res.statusCode);
        }
      });
    };
    const listing = '/api/tribes';
    const detail = '/api/tribes/:tribe';
    const members = '/api/tribes/:tribe/members';

    for (const role of ['admin', 'user', 'guest']) {
      it(`lets ${role} read the catalogue and a circle`, async () => {
        (await decide(role, listing, 'GET')).should.equal(200);
        (await decide(role, detail, 'GET')).should.equal(200);
      });

      it(`refuses ${role} writes to the catalogue and a circle`, async () => {
        for (const path of [listing, detail, members]) {
          for (const method of ['POST', 'PUT', 'DELETE']) {
            (await decide(role, path, method)).should.equal(403);
          }
        }
      });
    }

    for (const role of ['admin', 'user']) {
      it(`lets ${role} read circle members`, async () => {
        (await decide(role, members, 'GET')).should.equal(200);
      });
    }

    it('refuses guests the circle members listing', async () => {
      (await decide('guest', members, 'GET')).should.equal(403);
    });
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
