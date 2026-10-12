const {
  createRouteAuthorisation,
} = require('./../../server/services/route-authorisation.server.service.mjs');
require('should');

function mockResponse() {
  const response = {
    statusCode: 200,
    body: null,
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
  return response;
}

describe('Route authorisation service', function () {
  it('exposes the same factory through ESM', async function () {
    const { createRouteAuthorisation: esmFactory } = await import(
      '../../server/services/route-authorisation.server.service.mjs'
    );
    esmFactory.should.equal(createRouteAuthorisation);
  });

  it('uses guest permissions when the request has no user', function () {
    let aclArgs;
    const acl = {
      areAnyRolesAllowed(...args) {
        aclArgs = args;
        args[3](null, false);
      },
    };
    const response = mockResponse();

    createRouteAuthorisation(acl)(
      { route: { path: '/api/examples' }, method: 'GET' },
      response,
      function () {},
    );

    aclArgs.slice(0, 3).should.deepEqual([['guest'], '/api/examples', 'get']);
    response.statusCode.should.equal(403);
    response.body.message.should.equal('Forbidden.');
  });

  it('uses guest permissions when a user has no roles', function () {
    let roles;
    const acl = {
      areAnyRolesAllowed(requestRoles, path, method, callback) {
        roles = requestRoles;
        callback(null, true);
      },
    };

    createRouteAuthorisation(acl)(
      {
        user: { roles: null },
        route: { path: '/api/examples/:exampleId' },
        method: 'PATCH',
      },
      mockResponse(),
      function () {},
    );

    roles.should.deepEqual(['guest']);
  });

  it('retains member access for an unenrolled privileged user without member role', function () {
    let roles;
    const acl = {
      areAnyRolesAllowed(requestRoles, path, method, callback) {
        roles = requestRoles;
        callback(null, true);
      },
    };

    createRouteAuthorisation(acl)(
      {
        user: { roles: ['admin'], mfaEnabled: false },
        route: { path: '/api/examples' },
        method: 'GET',
      },
      mockResponse(),
      function () {},
    );

    roles.should.deepEqual(['user']);
  });

  it('passes the user roles and calls next when the ACL allows the request', function () {
    let aclArgs;
    let nextCalled = false;
    const acl = {
      areAnyRolesAllowed(...args) {
        aclArgs = args;
        args[3](null, true);
      },
    };

    createRouteAuthorisation(acl)(
      {
        user: { roles: ['member', 'helper'] },
        route: { path: '/api/examples' },
        method: 'POST',
      },
      mockResponse(),
      function () {
        nextCalled = true;
      },
    );

    aclArgs
      .slice(0, 3)
      .should.deepEqual([['member', 'helper'], '/api/examples', 'post']);
    nextCalled.should.be.true();
  });

  it('returns JSON 500 for unexpected ACL errors by default', function () {
    let jsonCalled = false;
    const response = mockResponse();
    const json = response.json;
    response.json = function (body) {
      jsonCalled = true;
      return json.call(this, body);
    };
    const acl = {
      areAnyRolesAllowed(roles, path, method, callback) {
        callback(new Error('ACL unavailable'));
      },
    };

    createRouteAuthorisation(acl)(
      {
        user: { roles: ['member'] },
        route: { path: '/api/examples' },
        method: 'GET',
      },
      response,
      function () {},
    );

    response.statusCode.should.equal(500);
    jsonCalled.should.be.true();
    response.body.message.should.equal('Unexpected authorization error');
  });

  it('uses the configured response method for unexpected ACL errors', function () {
    let sendCalled = false;
    const response = mockResponse();
    const send = response.send;
    response.send = function (body) {
      sendCalled = true;
      return send.call(this, body);
    };
    const acl = {
      areAnyRolesAllowed(roles, path, method, callback) {
        callback(new Error('ACL unavailable'));
      },
    };

    createRouteAuthorisation(acl, 'send')(
      {
        user: { roles: ['member'] },
        route: { path: '/api/examples' },
        method: 'GET',
      },
      response,
      function () {},
    );

    response.statusCode.should.equal(500);
    sendCalled.should.be.true();
    response.body.message.should.equal('Unexpected authorization error');
  });
});
