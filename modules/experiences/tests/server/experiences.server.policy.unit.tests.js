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
  const policy = proxyquire('../../server/policies/experiences.server.policy', {
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

describe('Experiences policy unit tests', () => {
  it('passes thrown ACL errors to next', async () => {
    const { policy, mockAcl } = loadPolicy();
    const aclError = new Error('acl down');
    mockAcl.areAnyRolesAllowed.rejects(aclError);
    let nextArg;

    await policy.isAllowed(
      {
        user: { public: true, roles: ['user'] },
        route: { path: '/api/experiences' },
        method: 'GET',
      },
      mockResponse(),
      err => {
        nextArg = err;
      },
    );

    nextArg.should.equal(aclError);
  });

  it('returns 403 for non-public users', async () => {
    const { policy } = loadPolicy();
    const res = mockResponse();

    await policy.isAllowed(
      {
        user: { public: false, roles: ['user'] },
        route: { path: '/api/experiences' },
        method: 'GET',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(403);
    res.body.message.should.equal('Forbidden.');
  });

  it('returns 403 when ACL denies access', async () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.resolves(false);
    const res = mockResponse();

    await policy.isAllowed(
      {
        user: { public: true, roles: ['guest'] },
        route: { path: '/api/experiences' },
        method: 'POST',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(403);
    res.body.message.should.equal('Forbidden.');
  });
});
