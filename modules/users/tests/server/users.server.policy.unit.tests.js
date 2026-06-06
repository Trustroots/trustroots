const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
require('should');

function loadPolicy() {
  const mockAcl = {
    allow: sinon.stub(),
    areAnyRolesAllowed: sinon.stub(),
  };
  const AclConstructor = function () {
    return mockAcl;
  };
  AclConstructor.memoryBackend = sinon.stub();
  const policy = proxyquire('../../server/policies/users.server.policy', {
    acl: AclConstructor,
  });
  return { policy, mockAcl };
}

function mockResponse() {
  const res = { statusCode: 200, body: null };
  res.status = code => {
    res.statusCode = code;
    return res;
  };
  res.json = body => {
    res.body = body;
    return res;
  };
  return res;
}

describe('Users policy unit tests', () => {
  it('returns 500 when authorization fails unexpectedly', done => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(new Error('acl down'));
    const res = mockResponse();

    policy.isAllowed(
      {
        user: { public: true, roles: ['user'] },
        route: { path: '/api/users/:username' },
        method: 'GET',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(500);
    res.body.message.should.equal('Unexpected authorization error');
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
    done();
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
    done();
  });

  it('returns 403 JSON when the user is not allowed', done => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, false);
    const res = mockResponse();

    policy.isAllowed(
      {
        user: { public: true, roles: ['guest'] },
        route: { path: '/api/users/:username' },
        method: 'PUT',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(403);
    res.body.message.should.equal('Forbidden.');
    done();
  });
});
