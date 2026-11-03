import type { PolicyUser } from '../../server/services/policy-types.server.mts';

const should: typeof import('should') = require('should');
void should;

describe('In-memory route permissions', function () {
  it('enforces a real admin route declaration', function () {
    const adminPolicy: typeof import('../../../admin/server/policies/admin.server.policy.mts').default = require('./../../../admin/server/policies/admin.server.policy.mts');
    adminPolicy.invokeRolesPolicies();
    const request: import('../../server/services/policy-types.server.mts').PolicyRequest & {
      user: PolicyUser;
    } = {
      user: { roles: ['admin'], _id: { valueOf: () => 'fixture-user' } },
      route: { path: '/api/admin/dashboard' },
      method: 'GET',
    };
    const response: import('../../server/services/policy-types.server.mts').PolicyResponse & {
      statusCode?: number;
      body?: { message: string };
    } = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
      send(body) {
        this.body = body;
        return this;
      },
    };
    let permitted = false;

    adminPolicy.isAllowed(request, response, function () {
      permitted = true;
    });
    permitted.should.equal(true);

    request.user.roles = ['user'];
    adminPolicy.isAllowed(request, response, function () {
      throw new Error('An ordinary member received admin access');
    });
    response.statusCode!.should.equal(403);
  });
});
