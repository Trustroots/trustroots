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
  const policy = proxyquire('../../server/policies/contacts.server.policy', {
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

describe('Contacts policy unit tests', () => {
  it('registers admin and user contact policies', () => {
    const { policy, mockAcl } = loadPolicy();

    policy.invokeRolesPolicies();

    mockAcl.allow.calledOnce.should.be.true();
    const policies = mockAcl.allow.firstCall.args[0];
    policies[0].roles.should.deepEqual(['admin']);
    policies[1].roles.should.deepEqual(['user']);
    policies[1].allows
      .map(allow => allow.resources)
      .should.containEql('/api/contacts/:listUserId/common');
  });

  it('allows contact parties to manipulate their connection', () => {
    const { policy, mockAcl } = loadPolicy();
    const userId = {
      valueOf: () => 'user-id',
    };
    const userFromId = {
      equals: sinon.stub().returns(true),
    };
    const next = sinon.stub();

    policy.isAllowed(
      {
        user: { _id: userId, public: true, roles: ['user'] },
        contact: {
          userFrom: { _id: userFromId },
          userTo: { _id: { equals: sinon.stub().returns(false) } },
        },
      },
      mockResponse(),
      next,
    );

    userFromId.equals.calledWith('user-id').should.be.true();
    mockAcl.areAnyRolesAllowed.called.should.be.false();
    next.calledOnce.should.be.true();
  });

  it('allows the other contact party to manipulate their connection', () => {
    const { policy } = loadPolicy();
    const userId = {
      valueOf: () => 'user-id',
    };
    const userToId = {
      equals: sinon.stub().returns(true),
    };
    const next = sinon.stub();

    policy.isAllowed(
      {
        user: { _id: userId, public: true, roles: ['user'] },
        contact: {
          userFrom: { _id: { equals: sinon.stub().returns(false) } },
          userTo: { _id: userToId },
        },
      },
      mockResponse(),
      next,
    );

    userToId.equals.calledWith('user-id').should.be.true();
    next.calledOnce.should.be.true();
  });

  it('calls next when ACL allows the request', () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, true);
    const next = sinon.stub();

    policy.isAllowed(
      {
        user: { public: true, roles: ['user'] },
        route: { path: '/api/contact-by/:contactUserId' },
        method: 'GET',
      },
      mockResponse(),
      next,
    );

    mockAcl.areAnyRolesAllowed
      .calledWith(['user'], '/api/contact-by/:contactUserId', 'get')
      .should.be.true();
    next.calledOnce.should.be.true();
  });

  it('checks guest permissions when there is no signed-in user', () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, false);

    policy.isAllowed(
      {
        route: { path: '/api/contact-by/:contactUserId' },
        method: 'GET',
      },
      mockResponse(),
      () => {},
    );

    mockAcl.areAnyRolesAllowed.firstCall.args[0].should.deepEqual(['guest']);
  });

  it('returns 500 when authorization fails unexpectedly', done => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(new Error('acl down'));
    const res = mockResponse();

    policy.isAllowed(
      {
        user: { public: true, roles: ['user'] },
        route: { path: '/api/contacts/:listUserId' },
        method: 'GET',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(500);
    res.body.message.should.equal('Unexpected authorization error');
    done();
  });

  it('returns 403 for unpublished users', done => {
    const { policy } = loadPolicy();
    const res = mockResponse();
    let nextCalled = false;

    policy.isAllowed(
      {
        user: { public: false, roles: ['user'] },
        route: { path: '/api/contacts/:listUserId' },
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

  it('returns 403 JSON when ACL denies access', () => {
    const { policy, mockAcl } = loadPolicy();
    mockAcl.areAnyRolesAllowed.yields(null, false);
    const res = mockResponse();

    policy.isAllowed(
      {
        user: { public: true, roles: ['user'] },
        route: { path: '/api/contact/:contactId' },
        method: 'DELETE',
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(403);
    res.body.message.should.equal('Forbidden.');
  });
});
