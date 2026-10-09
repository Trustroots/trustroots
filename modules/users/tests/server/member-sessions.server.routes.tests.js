const assert = require('node:assert/strict');
const should = require('should');
const sinon = require('sinon');
const request = require('supertest');
const mongoose = require('mongoose');
const express = require('../../../../config/lib/express.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');

const User = mongoose.model('User');
const MemberSession = mongoose.model('MemberSession');

describe('Member session controls', function () {
  let app;
  let checkMemberSession;
  let sessionId;
  let sessionLifetimes;
  let sessionsController;

  before(async function () {
    app = await express.init(mongoose.connection);
    ({ checkMemberSession, sessionId, sessionLifetimes } = await import(
      '../../server/services/member-session.server.service.mjs'
    ));
    sessionsController = await import(
      '../../server/controllers/users.sessions.server.controller.mjs'
    );
  });

  afterEach(utils.clearDatabase);
  afterEach(() => sinon.restore());

  function activeSessionRecord(overrides = {}) {
    const now = Date.now();
    return {
      user: new mongoose.Types.ObjectId(),
      authVersion: 0,
      createdAt: new Date(now),
      lastSeenAt: new Date(now),
      expiresAt: new Date(now + 86400000),
      revoked: false,
      ...overrides,
    };
  }

  async function runMiddleware(record, options = {}) {
    const now = Date.now();
    const Session = mongoose.model('MemberSession');
    sinon.stub(Session, 'updateOne').callsFake(async () => {
      if (options.upsertError) throw options.upsertError;
      return {};
    });
    sinon.stub(Session, 'findById').resolves(record);
    sinon
      .stub(Session, 'findOneAndUpdate')
      .resolves(
        options.updatedRecord === undefined ? record : options.updatedRecord,
      );

    const user = {
      _id:
        options.requestUserId || record?.user || new mongoose.Types.ObjectId(),
      authVersion: 0,
      roles: ['user'],
    };
    const req = {
      user,
      sessionID: 'opaque-session-id',
      session: {
        memberSessionCreatedAt: options.createdAt || now,
        destroy(callback) {
          options.destroyed = true;
          callback(options.destroyError);
        },
      },
    };
    let nextError;
    let nextCalled = false;
    await checkMemberSession(req, {}, error => {
      nextCalled = true;
      nextError = error;
    });
    return {
      req,
      nextCalled,
      nextError,
      options,
      activityUpdater: Session.findOneAndUpdate,
    };
  }

  function createResponse() {
    return {
      headers: {},
      statusCode: null,
      body: null,
      set(name, value) {
        this.headers[name] = value;
        return this;
      },
      vary(value) {
        this.headers.vary = value;
        return this;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
      sendStatus(code) {
        this.statusCode = code;
        return this;
      },
    };
  }

  function createNext() {
    const result = { called: false, error: null };
    result.next = error => {
      result.called = true;
      result.error = error;
    };
    return result;
  }

  it('uses deterministic opaque identifiers and shorter privileged lifetimes', function () {
    sessionId('session-value').should.equal(sessionId('session-value'));
    sessionId('session-value').should.match(/^[a-f0-9]{64}$/);
    const expected = {
      idle: 7 * 86400000,
      absolute: 28 * 86400000,
    };
    sessionLifetimes({ roles: ['user'] }).should.deepEqual(expected);
    const privileged = { idle: 30 * 60000, absolute: 12 * 60 * 60000 };
    sessionLifetimes({ roles: ['moderator'] }).should.deepEqual(privileged);
    sessionLifetimes({ roles: ['admin'] }).should.deepEqual(privileged);
    sessionLifetimes({ roles: ['welcome-team'] }).should.deepEqual(privileged);
  });

  it('continues anonymous requests without creating a member-session record', async function () {
    const req = { user: undefined };
    let nextCalled = false;
    await checkMemberSession(req, {}, () => {
      nextCalled = true;
    });
    nextCalled.should.equal(true);
  });

  it('recovers a concurrent first-record upsert and continues the active session', async function () {
    const record = activeSessionRecord();
    const result = await runMiddleware(record, {
      upsertError: { code: 11000 },
    });
    result.nextCalled.should.equal(true);
    should.not.exist(result.nextError);
    result.req.user._id.should.equal(record.user);
  });

  it('passes storage failures and a missing record to error handling', async function () {
    const storageError = new Error('storage unavailable');
    const failedWrite = await runMiddleware(null, {
      upsertError: storageError,
    });
    failedWrite.nextError.should.equal(storageError);

    sinon.restore();
    const missingRecord = await runMiddleware(null);
    missingRecord.nextError.should.be.Error();
  });

  it('destroys revoked, expired, idle, foreign, and stale-version sessions', async function () {
    const now = Date.now();
    const testCases = [
      { record: activeSessionRecord({ revoked: true }) },
      {
        record: activeSessionRecord(),
        createdAt: now - 28 * 86400000,
      },
      {
        record: activeSessionRecord({
          lastSeenAt: new Date(now - 8 * 86400000),
        }),
      },
      {
        record: activeSessionRecord({ user: new mongoose.Types.ObjectId() }),
        requestUserId: new mongoose.Types.ObjectId(),
      },
      { record: activeSessionRecord({ authVersion: 1 }) },
    ];

    for (const testCase of testCases) {
      const result = await runMiddleware(testCase.record, testCase);
      assert.equal(result.options.destroyed, true);
      assert.equal(result.req.user, undefined);
      result.nextCalled.should.equal(true);
      should.not.exist(result.nextError);
      sinon.restore();
    }
  });

  it('refreshes old activity timestamps and destroys a session revoked during refresh', async function () {
    const record = activeSessionRecord({
      lastSeenAt: new Date(Date.now() - 61000),
    });
    const refreshed = await runMiddleware(record);
    refreshed.nextCalled.should.equal(true);
    refreshed.activityUpdater.calledOnce.should.equal(true);

    sinon.restore();
    const revokedDuringRefresh = await runMiddleware(record, {
      updatedRecord: null,
    });
    revokedDuringRefresh.options.destroyed.should.equal(true);
    assert.equal(revokedDuringRefresh.req.user, undefined);
  });

  it('forwards failures while destroying a session', async function () {
    const destroyError = new Error('session store unavailable');
    const invalidSession = await runMiddleware(
      activeSessionRecord({ revoked: true }),
      { destroyError },
    );
    invalidSession.nextError.should.equal(destroyError);

    sinon.restore();
    const result = await runMiddleware(
      activeSessionRecord({ lastSeenAt: new Date(Date.now() - 61000) }),
      { updatedRecord: null, destroyError },
    );
    result.nextError.should.equal(destroyError);
  });

  it('handles controller validation, storage errors, and current-session revoke', async function () {
    const userId = new mongoose.Types.ObjectId();
    const user = { _id: userId, authVersion: 0, roles: ['user'] };
    const req = {
      user,
      body: {},
      params: {},
      sessionID: 'opaque-session-id',
      session: { destroy: callback => callback() },
    };
    let res = createResponse();
    let next = createNext();

    sessionsController.requireMember({ user: null }, res, next.next);
    res.statusCode.should.equal(403);
    res.headers['Cache-Control'].should.equal('no-store');
    res.headers.vary.should.equal('Cookie');
    next.called.should.equal(false);
    sessionsController.requireMember(req, res, next.next);
    next.called.should.equal(true);

    sinon.stub(MemberSession, 'find').throws(new Error('list failed'));
    next = createNext();
    await sessionsController.list(req, createResponse(), next.next);
    next.error.message.should.equal('list failed');
    sinon.restore();

    for (const body of [{}, { password: 42 }, { password: 'x'.repeat(1025) }]) {
      res = createResponse();
      await sessionsController.confirmPassword({ ...req, body }, res, () => {});
      res.statusCode.should.equal(400);
    }

    sinon.stub(User, 'findById').resolves(null);
    res = createResponse();
    await sessionsController.confirmPassword(
      { ...req, body: { password: 'valid' } },
      res,
      () => {},
    );
    res.statusCode.should.equal(400);
    sinon.restore();

    sinon.stub(User, 'findById').resolves({
      authVersion: 1,
      authenticate: async () => true,
    });
    res = createResponse();
    await sessionsController.confirmPassword(
      { ...req, body: { password: 'valid' } },
      res,
      () => {},
    );
    res.statusCode.should.equal(403);
    sinon.restore();

    sinon.stub(User, 'findById').throws(new Error('password lookup failed'));
    next = createNext();
    await sessionsController.confirmPassword(
      { ...req, body: { password: 'valid' } },
      createResponse(),
      next.next,
    );
    next.error.message.should.equal('password lookup failed');
    sinon.restore();

    res = createResponse();
    await sessionsController.revoke(
      { ...req, params: { id: 'bad' } },
      res,
      () => {},
    );
    res.statusCode.should.equal(404);

    sinon.stub(MemberSession, 'findOneAndUpdate').resolves(null);
    res = createResponse();
    await sessionsController.revoke(
      { ...req, params: { id: 'a'.repeat(64) } },
      res,
      () => {},
    );
    res.statusCode.should.equal(404);
    sinon.restore();

    const currentId = sessionId(req.sessionID);
    sinon.stub(MemberSession, 'findOneAndUpdate').resolves({});
    req.session.destroy = callback => callback();
    res = createResponse();
    await sessionsController.revoke(
      { ...req, params: { id: currentId } },
      res,
      () => {},
    );
    res.statusCode.should.equal(204);
    sinon.restore();

    sinon.stub(MemberSession, 'findOneAndUpdate').resolves({});
    req.session.destroy = callback =>
      callback(new Error('revoke destroy failed'));
    next = createNext();
    await sessionsController.revoke(
      { ...req, params: { id: currentId } },
      createResponse(),
      next.next,
    );
    next.error.message.should.equal('revoke destroy failed');
    sinon.restore();

    sinon
      .stub(MemberSession, 'findOneAndUpdate')
      .throws(new Error('revoke failed'));
    next = createNext();
    await sessionsController.revoke(
      { ...req, params: { id: 'a'.repeat(64) } },
      createResponse(),
      next.next,
    );
    next.error.message.should.equal('revoke failed');
    sinon.restore();

    sinon.stub(User, 'updateOne').throws(new Error('version update failed'));
    next = createNext();
    await sessionsController.revokeAll(req, createResponse(), next.next);
    next.error.message.should.equal('version update failed');
    sinon.restore();

    sinon.stub(User, 'updateOne').resolves({});
    sinon
      .stub(MemberSession, 'updateMany')
      .throws(new Error('revoke all failed'));
    next = createNext();
    await sessionsController.revokeAll(req, createResponse(), next.next);
    next.error.message.should.equal('revoke all failed');
    sinon.restore();

    sinon.stub(User, 'updateOne').resolves({});
    sinon.stub(MemberSession, 'updateMany').resolves({});
    req.session.destroy = callback => callback(new Error('destroy failed'));
    next = createNext();
    await sessionsController.revokeAll(req, createResponse(), next.next);
    next.error.message.should.equal('destroy failed');
    sinon.restore();

    req.session.destroy = callback => callback();
    res = createResponse();
    await sessionsController.revokeAll(req, res, () => {});
    res.statusCode.should.equal(204);
  });

  async function createMember() {
    const credentials = {
      username: 'session-control-member',
      password: 'ExamplePassword123!',
    };
    const user = await new User({
      ...credentials,
      firstName: 'Example',
      lastName: 'Member',
      email: 'session-control@example.test',
      provider: 'local',
      roles: ['user'],
    }).save();
    return { credentials, user };
  }

  async function signIn(agent, credentials) {
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    return agent.get('/api/auth/sessions').expect(200);
  }

  it('lists only the member’s opaque active sessions and marks the current one', async function () {
    const { credentials, user } = await createMember();
    const current = request.agent(app);
    const other = request.agent(app);
    const currentList = await signIn(current, credentials);
    const otherList = await signIn(other, credentials);
    await MemberSession.create({
      _id: 'c'.repeat(64),
      user: user._id,
      authVersion: 0,
      createdAt: new Date(Date.now() - 10 * 86400000),
      lastSeenAt: new Date(Date.now() - 8 * 86400000),
      expiresAt: new Date(Date.now() + 86400000),
    });
    const refreshedCurrentList = await current
      .get('/api/auth/sessions')
      .expect(200);

    currentList.body.should.have.length(1);
    refreshedCurrentList.body.should.have.length(2);
    otherList.body.should.have.length(2);
    Object.keys(currentList.body[0])
      .sort()
      .should.deepEqual(['createdAt', 'current', 'id', 'lastSeenAt']);
    currentList.body[0].id.should.match(/^[a-f0-9]{64}$/);
    currentList.body[0].current.should.equal(true);
    otherList.body
      .find(session => session.current)
      .id.should.not.equal(currentList.body[0].id);
    (await MemberSession.countDocuments({ user: user._id })).should.equal(3);

    const anonymous = await request(app).get('/api/auth/sessions').expect(403);
    anonymous.headers['cache-control'].should.equal('no-store');
    anonymous.headers.vary.should.match(/Cookie/);
  });

  it('requires the current password and revokes the selected session', async function () {
    const { credentials } = await createMember();
    const current = request.agent(app);
    const other = request.agent(app);
    await signIn(current, credentials);
    await signIn(other, credentials);
    const allSessions = await current.get('/api/auth/sessions').expect(200);
    const otherSession = allSessions.body.find(session => !session.current);

    await current
      .delete(`/api/auth/sessions/${otherSession.id}`)
      .set('X-Trustroots-Request', '1')
      .send({ password: 'incorrect-password' })
      .expect(400);
    await current
      .delete(`/api/auth/sessions/${otherSession.id}`)
      .set('X-Trustroots-Request', '1')
      .send({ password: credentials.password })
      .expect(204);

    const revoked = await MemberSession.findById(otherSession.id);
    should.exist(revoked);
    revoked.revoked.should.equal(true);
    (await other.get('/api/users/export').expect(403)).status.should.equal(403);
    (await current.get('/api/users/export').expect(200)).status.should.equal(
      200,
    );
  });

  it('increments the authentication version and signs out every session', async function () {
    const { credentials, user } = await createMember();
    const current = request.agent(app);
    const other = request.agent(app);
    await signIn(current, credentials);
    await signIn(other, credentials);

    await current
      .delete('/api/auth/sessions')
      .set('X-Trustroots-Request', '1')
      .send({ password: credentials.password })
      .expect(204);

    const updatedUser = await User.findById(user._id);
    updatedUser.authVersion.should.equal(1);
    (
      await MemberSession.countDocuments({ user: user._id, revoked: true })
    ).should.equal(2);
    const currentSession = await current.get('/api/auth/session').expect(200);
    should(currentSession.body.userId).equal(null);
    (await other.get('/api/users/export').expect(403)).status.should.equal(403);
  });
});
