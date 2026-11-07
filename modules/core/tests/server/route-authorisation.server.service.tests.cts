import type {
  MemoryPolicy,
  PolicyDecisionCallback,
  PolicyRequest,
  PolicyResponse,
} from '../../server/services/policy-types.server.mts';

const {
  createRouteAuthorisation,
}: typeof import('../../server/services/route-authorisation.server.service.mts') = require('./../../server/services/route-authorisation.server.service.mts');
const should: typeof import('should') = require('should');
void should;

type MockResponse = PolicyResponse & {
  statusCode: number;
  body: { message: string } | null;
};

function mockResponse(): MockResponse {
  const response: MockResponse = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: { message: string }) {
      this.body = body;
      return this;
    },
    send(body: { message: string }) {
      this.body = body;
      return this;
    },
  };
  return response;
}

type AclCall = {
  roles: string[];
  path: string;
  method: string;
};

function mockAcl(error: Error | null, allowed: boolean) {
  let call: AclCall | undefined;
  const acl: MemoryPolicy = {
    allow() {},
    areAnyRolesAllowed(
      roles: string[],
      path: string,
      method: string,
      callback?: PolicyDecisionCallback,
    ) {
      call = { roles, path, method };
      if (callback) callback(error, allowed);
      return Promise.resolve(allowed);
    },
  };
  return { acl, getCall: () => call };
}

function policyRequest(
  roles: string[] | null | undefined,
  routePath: string,
  method: string,
): PolicyRequest {
  const user =
    roles === undefined
      ? undefined
      : {
          roles,
          _id: { valueOf: () => 'fixture-user' },
        };
  return {
    user,
    route: { path: routePath },
    method,
  } as PolicyRequest;
}

describe('Route authorisation service', function () {
  it('exposes the same factory through ESM', async function () {
    const { createRouteAuthorisation: esmFactory } =
      await import('../../server/services/route-authorisation.server.service.mts');
    esmFactory.should.equal(createRouteAuthorisation);
  });

  it('uses guest permissions when the request has no user', function () {
    const { acl, getCall } = mockAcl(null, false);
    const response = mockResponse();

    createRouteAuthorisation(acl)(
      policyRequest(undefined, '/api/examples', 'GET'),
      response,
      function () {},
    );

    getCall()!.should.deepEqual({
      roles: ['guest'],
      path: '/api/examples',
      method: 'get',
    });
    response.statusCode.should.equal(403);
    response.body!.message.should.equal('Forbidden.');
  });

  it('returns JSON 500 for unexpected ACL errors by default', function () {
    const response = mockResponse();
    let jsonCalled = false;
    const json = response.json;
    response.json = function (body: { message: string }) {
      jsonCalled = true;
      return json.call(this, body);
    };
    const { acl } = mockAcl(new Error('ACL unavailable'), false);

    createRouteAuthorisation(acl)(
      policyRequest(['member'], '/api/examples', 'GET'),
      response,
      function () {},
    );

    response.statusCode.should.equal(500);
    jsonCalled.should.be.true();
    response.body!.message.should.equal('Unexpected authorization error');
  });
});
