const createMemoryPolicy = require('../../../core/server/services/memory-policy.server.service');
require('should');

describe('In-memory route permissions', function () {
  let policy;

  it('exposes the same factory through ESM', async function () {
    const { createMemoryPolicy: esmFactory } = await import(
      '../../../core/server/services/memory-policy.server.service.mjs'
    );
    esmFactory.should.equal(createMemoryPolicy);
  });

  beforeEach(function () {
    policy = createMemoryPolicy();
  });

  it('grants configured methods to any matching role and denies other routes', async function () {
    policy.allow([
      {
        roles: ['member', 'admin'],
        allows: [
          {
            resources: '/api/examples/:exampleId',
            permissions: ['get', 'put'],
          },
        ],
      },
    ]);

    (
      await policy.areAnyRolesAllowed(
        ['guest', 'member'],
        '/api/examples/:exampleId',
        'get',
      )
    ).should.equal(true);
    (
      await policy.areAnyRolesAllowed(
        ['guest'],
        '/api/examples/:exampleId',
        'get',
      )
    ).should.equal(false);
    (
      await policy.areAnyRolesAllowed(
        ['member'],
        '/api/examples/:exampleId',
        'delete',
      )
    ).should.equal(false);
    (
      await policy.areAnyRolesAllowed(['member'], '/api/other', 'get')
    ).should.equal(false);
  });

  it('preserves wildcard permissions and merges repeated grants', async function () {
    policy.allow([
      {
        roles: ['admin'],
        allows: [{ resources: '/api/examples', permissions: '*' }],
      },
    ]);
    policy.allow([
      {
        roles: ['admin'],
        allows: [{ resources: '/api/examples', permissions: ['get'] }],
      },
    ]);

    (
      await policy.areAnyRolesAllowed(['admin'], '/api/examples', 'delete')
    ).should.equal(true);
  });

  it('supports callback-based policy checks', function () {
    policy.allow([
      {
        roles: ['member'],
        allows: [{ resources: '/api/examples', permissions: ['post'] }],
      },
    ]);

    policy.areAnyRolesAllowed(
      ['member'],
      '/api/examples',
      'post',
      function (err, allowed) {
        if (err) throw err;
        allowed.should.equal(true);
      },
    );
  });
  it('enforces a real admin route declaration', function () {
    const adminPolicy = require('../../../admin/server/policies/admin.server.policy');
    adminPolicy.invokeRolesPolicies();
    const request = {
      user: { roles: ['admin'] },
      route: { path: '/api/admin/dashboard' },
      method: 'GET',
    };
    const response = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
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
    response.statusCode.should.equal(403);
  });
});
