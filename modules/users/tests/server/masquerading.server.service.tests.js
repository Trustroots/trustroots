const sinon = require('sinon');
const should = require('should');
const mongoose = require('mongoose');
const service = require('../../server/services/masquerading.server.service.mjs');
const limits = require('../../../core/server/services/targeted-request-limits.server.service.mjs');
const User = mongoose.model('User');
const AuditLog = mongoose.model('AuditLog');

describe('View-only masquerading boundary', function () {
  let actor;
  let target;
  let req;
  let res;
  let next;
  let find;
  let audit;
  const generation = 'example-view-generation';
  function active() {
    req.session.viewGeneration = generation;
    req.headers['X-Trustroots-View'] = generation;
    req.session.masquerade = {
      target: target.id,
      username: target.username,
      authVersion: 0,
      expiresAt: Date.now() + 60000,
      correlation: 'example-correlation',
    };
  }
  beforeEach(function () {
    actor = {
      _id: new mongoose.Types.ObjectId(),
      roles: ['admin'],
      authVersion: 0,
      authenticate: sinon.stub().resolves(true),
    };
    actor.id = String(actor._id);
    target = {
      _id: new mongoose.Types.ObjectId(),
      roles: ['user'],
      username: 'examplemember',
    };
    target.id = String(target._id);
    req = {
      user: actor,
      actor,
      path: '/api/messages',
      method: 'GET',
      body: {},
      headers: {},
      get(name) {
        return this.headers[name];
      },
      session: {
        regenerate(callback) {
          req.session = { save: done => done() };
          callback();
        },
      },
    };
    res = {
      locals: {},
      statusCode: 200,
      set: sinon.stub().returnsThis(),
      vary: sinon.stub().returnsThis(),
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    next = sinon.spy();
    find = sinon
      .stub(User, 'findById')
      .callsFake(id =>
        String(id) === actor.id
          ? Promise.resolve(actor)
          : { select: sinon.stub().resolves(target) },
      );
    audit = sinon.stub(AuditLog, 'create').resolves({});
    sinon.stub(limits, 'consume').resolves({ allowed: true });
  });
  afterEach(() => sinon.restore());

  it('registers its guard before both lifecycle routes', function () {
    const app = { use: sinon.spy(), post: sinon.spy() };
    service.register(app);
    app.use.calledBefore(app.post).should.be.true();
    app.post.callCount.should.equal(2);
  });
  it('leaves ordinary sessions unchanged', async function () {
    await service.middleware(req, res, next);
    next.calledOnce.should.be.true();
    should(res.locals.viewContext).be.null();
    audit.called.should.be.false();
  });
  it('returns the current generation after restoration', async function () {
    req.session.viewGeneration = generation;
    req.path = '/api/auth/session';
    await service.middleware(req, res, next);
    res.body.should.deepEqual({ userId: actor.id, viewGeneration: generation });
    req.user = null;
    await service.middleware(req, res, next);
    should(res.body.userId).be.null();
  });
  it('rejects requests from a stale tab before loading the member', async function () {
    active();
    delete req.headers['X-Trustroots-View'];
    await service.middleware(req, res, next);
    res.statusCode.should.equal(409);
    find.called.should.be.false();
    next.called.should.be.false();
  });
  it('rejects a previous member-view token after sign-out or a new ordinary login', async function () {
    req.headers['X-Trustroots-View'] = generation;
    await service.middleware(req, res, next);
    res.statusCode.should.equal(409);
    next.called.should.be.false();
  });
  it('uses the member for reads and the administrator for auditing', async function () {
    active();
    req.headers['!~Passenger-Client-Address'] = '192.0.2.10';
    await service.middleware(req, res, next);
    req.user.should.equal(target);
    req.actor.should.equal(actor);
    req.memberView.should.be.true();
    next.calledOnce.should.be.true();
    const event = audit.firstCall.args[0];
    event.user.should.equal(actor._id);
    event.body.target.should.equal(target.id);
    event.body.outcome.should.equal('authorised');
    event.ip.should.equal('192.0.2.10');
    should(event.body.password).be.undefined();
  });
  for (const [method, path] of [
    ['POST', '/api/messages-read'],
    ['POST', '/api/auth/session'],
    ['POST', '/not-an-api-route'],
    ['PUT', '/API/USERS'],
    ['GET', '/api/users/EXPORT'],
    ['PUT', '/api/users'],
    ['DELETE', '/api/users'],
    ['POST', '/api/users/push/registrations'],
    ['GET', '/api/admin/dashboard'],
    ['GET', '/api/users/export'],
    ['GET', '/api/users/unified-push'],
    ['GET', '/api/users/password'],
    ['GET', '/api/auth/reset/example'],
    ['GET', '/api/unknown'],
    ['POST', '/api/auth/masquerade'],
  ])
    it(`blocks ${method} ${path} before handlers run`, async function () {
      active();
      req.method = method;
      req.path = path;
      await service.middleware(req, res, next);
      res.body.code.should.equal('VIEW_READ_ONLY');
      next.called.should.be.false();
    });
  it('allows document bootstrap without treating it as an API read', async function () {
    active();
    req.path = '/profile/examplemember';
    delete req.headers['X-Trustroots-View'];
    await service.middleware(req, res, next);
    next.calledOnce.should.be.true();
    audit.firstCall.args[0].route.should.equal('masquerade:document');
  });
  it('returns effective identity and generation from the session endpoint', async function () {
    active();
    req.path = '/api/auth/session';
    delete req.headers['X-Trustroots-View'];
    await service.middleware(req, res, next);
    res.body.should.deepEqual({
      userId: target.id,
      viewGeneration: generation,
    });
  });
  for (const invalid of [
    'deadline',
    'actor-role',
    'actor-missing',
    'target-missing',
    'target-role',
    'target-version',
  ]) {
    it(`ends access after ${invalid} changes`, async function () {
      active();
      if (invalid === 'deadline') req.session.masquerade.expiresAt = 0;
      if (invalid === 'actor-role') actor.roles = ['user'];
      if (invalid === 'actor-missing') req.user = undefined;
      if (invalid === 'target-missing') target = null;
      if (invalid === 'target-role') target.roles = ['suspended'];
      if (invalid === 'target-version') target.authVersion = 1;
      await service.middleware(req, res, next);
      res.statusCode.should.equal(409);
      should(req.user).be.undefined();
      res.locals.viewContext.expired.should.be.true();
      next.called.should.be.false();
      req.path = '/signin';
      await service.middleware(req, res, next);
      next.calledOnce.should.be.true();
    });
  }
  it('refuses private reads when auditing fails', async function () {
    active();
    audit.rejects(new Error('database unavailable'));
    await service
      .middleware(req, res, next)
      .should.be.rejectedWith('database unavailable');
    next.called.should.be.false();
  });
  it('allows explicit exit even when expired', async function () {
    active();
    req.path = '/api/auth/masquerade/stop';
    req.method = 'POST';
    req.session.masquerade.expiresAt = 0;
    await service.middleware(req, res, next);
    next.calledOnce.should.be.true();
  });
  it('accepts the generation on the sign-out form and records departure', async function () {
    active();
    req.path = '/api/auth/signout';
    req.method = 'POST';
    delete req.headers['X-Trustroots-View'];
    req.body.viewGeneration = generation;
    await service.middleware(req, res, next);
    next.calledOnce.should.be.true();
    audit.firstCall.args[0].body.outcome.should.equal('signed-out');
  });
  function startRequest() {
    req.body = {
      targetId: target.id,
      password: 'FictionalPassword123!',
      reason: 'Investigate a display problem',
    };
  }
  it('starts an audited, rotated session without signing Passport in as the member', async function () {
    startRequest();
    await service.start(req, res);
    req.session.passport.user.should.deepEqual({
      id: actor.id,
      authVersion: 0,
    });
    req.session.masquerade.target.should.equal(target.id);
    (req.session.masquerade.expiresAt - Date.now()).should.be.within(
      890000,
      900000,
    );
    req.session.viewGeneration.should.be.a.String();
    audit.firstCall.args[0].body.reason.should.equal(req.body.reason);
    res.body.redirect.should.equal(`/profile/${target.username}`);
  });
  for (const invalid of [
    'actor-missing',
    'actor-role',
    'nested',
    'id',
    'password-type',
    'password-long',
    'reason-type',
    'reason-empty',
    'reason-long',
    'limited',
    'actor-removed',
    'actor-changed',
    'actor-version',
    'password',
    'target-removed',
    'target-admin',
    'target-self',
  ]) {
    it(`rejects invalid entry: ${invalid}`, async function () {
      startRequest();
      if (invalid === 'actor-missing') req.actor = null;
      if (invalid === 'actor-role') actor.roles = ['user'];
      if (invalid === 'nested') active();
      if (invalid === 'id') req.body.targetId = 'invalid';
      if (invalid === 'password-type') req.body.password = {};
      if (invalid === 'password-long') req.body.password = 'a'.repeat(1025);
      if (invalid === 'reason-type') req.body.reason = [];
      if (invalid === 'reason-empty') req.body.reason = ' ';
      if (invalid === 'reason-long') req.body.reason = 'a'.repeat(501);
      if (invalid === 'limited')
        limits.consume.resolves({ allowed: false, retryAfterSeconds: 60 });
      if (invalid === 'actor-removed') find.onFirstCall().resolves(null);
      if (invalid === 'actor-changed')
        find.onFirstCall().resolves({ ...actor, roles: ['user'] });
      if (invalid === 'actor-version')
        find.onFirstCall().resolves({ ...actor, authVersion: 1 });
      if (invalid === 'password') actor.authenticate.resolves(false);
      if (invalid === 'target-removed') target = null;
      if (invalid === 'target-admin') target.roles = ['admin'];
      if (invalid === 'target-self') {
        req.body.targetId = actor.id;
        find.onSecondCall().returns({ select: sinon.stub().resolves(actor) });
      }
      await service.start(req, res);
      res.statusCode.should.be.within(400, 429);
      audit.called.should.be.false();
    });
  }
  it('clears temporary state when entry auditing fails', async function () {
    startRequest();
    audit.rejects(new Error('audit unavailable'));
    await service.start(req, res).should.be.rejectedWith('audit unavailable');
    should(req.session.masquerade).be.undefined();
  });
  it('returns to a fresh administrator context', async function () {
    active();
    await service.stop(req, res);
    req.session.passport.user.id.should.equal(actor.id);
    should(req.session.masquerade).be.undefined();
    req.session.viewGeneration.should.not.equal(generation);
    res.body.redirect.should.equal(`/admin/user/${target.username}`);
  });
  it('still exits when departure auditing fails', async function () {
    active();
    audit.rejects(new Error('audit unavailable'));
    await service.stop(req, res);
    should(req.session.masquerade).be.undefined();
  });
  it('keeps expired documents and sign-out usable when lifecycle auditing fails', async function () {
    active();
    audit.rejects(new Error('audit unavailable'));
    req.session.masquerade.expiresAt = 0;
    req.path = '/signin';
    await service.middleware(req, res, next);
    next.calledOnce.should.be.true();
    req.user = actor;
    req.path = '/api/auth/signout';
    req.method = 'POST';
    await service.middleware(req, res, next);
    next.calledTwice.should.be.true();
  });
  it('rejects missing bodies without running lifecycle handlers', async function () {
    req.body = undefined;
    await service.start(req, res);
    res.statusCode.should.equal(400);
    active();
    req.path = '/api/auth/signout';
    req.method = 'POST';
    delete req.headers['X-Trustroots-View'];
    await service.middleware(req, res, next);
    res.statusCode.should.equal(409);
  });
  it('retains non-zero authentication versions and reports expired session identities safely', async function () {
    actor.authVersion = 3;
    req.body = {
      targetId: target.id,
      password: 'FictionalPassword123!',
      reason: 'Reproduce a display problem',
    };
    await service.start(req, res);
    req.session.passport.user.authVersion.should.equal(3);
    req.session.masquerade.expiresAt = 0;
    req.path = '/api/auth/session';
    await service.middleware(req, res, next);
    should(res.body.userId).be.null();
  });
  it('requires an authorised actor and an existing view to exit', async function () {
    req.actor = null;
    await service.stop(req, res);
    res.statusCode.should.equal(401);
    req.actor = { ...actor, roles: ['user'] };
    await service.stop(req, res);
    res.statusCode.should.equal(401);
    req.actor = actor;
    await service.stop(req, res);
    res.statusCode.should.equal(400);
  });
  for (const operation of ['regenerate', 'save'])
    it(`propagates ${operation} failures without granting a session`, async function () {
      startRequest();
      req.session.regenerate = callback => {
        if (operation === 'regenerate')
          return callback(new Error('session unavailable'));
        req.session = { save: done => done(new Error('session unavailable')) };
        callback();
      };
      await service
        .start(req, res)
        .should.be.rejectedWith('session unavailable');
      should(res.body).be.undefined();
    });
});
