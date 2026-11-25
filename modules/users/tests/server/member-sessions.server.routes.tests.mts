import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import should from 'should';
import sinon from 'sinon';
import request from 'supertest';
import mongoose from 'mongoose';
import config from '../../../../config/config.mts';
import express from '../../../../config/lib/express.mts';
import * as utils from '../../../../testutils/server/data.server.testutil.mts';
import type { TestAgent } from '../../../../testutils/server/model-contracts.mts';
import {
  checkMemberSession,
  sessionId,
  sessionLifetimes,
  type MemberBrowserRequest,
} from '../../server/services/member-session.server.service.mts';
import * as sessionsController from '../../server/controllers/users.sessions.server.controller.mts';

const User = mongoose.model('User');
const MemberSession = mongoose.model('MemberSession');
const AccountActivity = mongoose.model('AccountActivity');

describe('Member session controls', function () {
  let app: Awaited<ReturnType<typeof express.init>>;

  before(async function () {
    app = await express.init(mongoose.connection);
  });

  afterEach(utils.clearDatabase);
  afterEach(() => sinon.restore());

  type SessionRecord = {
    user: mongoose.Types.ObjectId;
    authVersion: number;
    createdAt: Date;
    lastSeenAt: Date;
    expiresAt: Date;
    revoked: boolean;
  };
  type MiddlewareOptions = {
    upsertError?: unknown;
    updatedRecord?: SessionRecord | null;
    requestUserId?: mongoose.Types.ObjectId;
    createdAt?: number;
    legacySession?: boolean;
    authVersion?: number;
    destroyed?: boolean;
    destroyError?: Error;
  };

  function activeSessionRecord(
    overrides: Partial<SessionRecord> = {},
  ): SessionRecord {
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

  async function runMiddleware(
    record: SessionRecord | null,
    options: MiddlewareOptions = {},
  ) {
    const now = Date.now();
    const Session = mongoose.model('MemberSession');
    const sessionUpserter = sinon
      .stub(Session, 'updateOne')
      .callsFake((async () => {
        if (options.upsertError) throw options.upsertError;
        return {};
      }) as unknown as typeof Session.updateOne);
    sinon.stub(Session, 'findById').resolves(record);
    const activityUpdater = sinon
      .stub(Session, 'findOneAndUpdate')
      .resolves(
        options.updatedRecord === undefined ? record : options.updatedRecord,
      );

    const user = {
      _id:
        options.requestUserId || record?.user || new mongoose.Types.ObjectId(),
      authVersion: options.authVersion ?? 0,
      roles: ['user'],
    };
    const req: MemberBrowserRequest = {
      user,
      sessionID: 'opaque-session-id',
      session: {
        memberSessionCreatedAt: options.legacySession
          ? undefined
          : options.createdAt || now,
        destroy(callback) {
          options.destroyed = true;
          callback(options.destroyError);
        },
      },
    };
    let nextError: unknown;
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
      sessionUpserter,
      activityUpdater,
    };
  }

  function createResponse() {
    return {
      headers: {} as Record<string, string>,
      statusCode: 0,
      body: undefined as unknown,
      set(name: string, value: string) {
        this.headers[name] = value;
        return this;
      },
      vary(value: string) {
        this.headers.vary = value;
        return this;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(body: unknown) {
        this.body = body;
        return this;
      },
      sendStatus(code: number) {
        this.statusCode = code;
        return this;
      },
    };
  }

  function createNext() {
    const result = {
      called: false,
      error: undefined as Error | undefined,
      next(error?: unknown) {
        result.called = true;
        result.error = error instanceof Error ? error : undefined;
      },
    };
    return result;
  }

  it('initialises the lifetime of a legacy session on its first request', async function () {
    const now = Date.now();
    sinon.stub(Date, 'now').returns(now);
    const result = await runMiddleware(activeSessionRecord(), {
      legacySession: true,
    });
    assert.equal(result.req.session.memberSessionCreatedAt, now);
    assert.equal(result.nextCalled, true);
    assert.equal(result.nextError, undefined);
    const { $setOnInsert: inserted } = result.sessionUpserter.firstCall
      .args[1] as {
      $setOnInsert: { createdAt: Date; lastSeenAt: Date };
    };
    assert.equal(inserted.createdAt.getTime(), now);
    assert.equal(inserted.lastSeenAt.getTime(), now);
  });

  it('uses deterministic opaque identifiers and equal member lifetimes', function () {
    const expectedId = crypto
      .createHmac('sha256', config.sessionSecret)
      .update('member-session:session-value')
      .digest('hex');
    sessionId('session-value').should.equal(expectedId);
    sessionId('session-value').should.match(/^[a-f0-9]{64}$/);
    assert.notEqual(sessionId('session-value'), sessionId('another-session'));
    const expected = {
      idle: 7 * 86400000,
      absolute: 28 * 86400000,
    };
    sessionLifetimes().should.deepEqual(expected);
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

  it('keeps the activity event id when recording fails so a later request can retry', async function () {
    const record = activeSessionRecord();
    const eventId = 'stable-session-event-id';
    sinon.stub(MemberSession, 'updateOne').resolves({
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 0,
      upsertedCount: 0,
      upsertedId: null,
    });
    sinon.stub(MemberSession, 'findById').resolves(record);
    sinon.stub(MemberSession, 'findOneAndUpdate').resolves(record);
    const updateActivity = sinon
      .stub(AccountActivity, 'updateOne')
      .rejects(new Error('activity store unavailable'));
    const req: MemberBrowserRequest = {
      user: { _id: record.user, authVersion: 0 },
      sessionID: 'opaque-session-id',
      session: {
        memberSessionCreatedAt: Date.now(),
        memberActivityEventId: eventId,
        destroy(callback) {
          callback();
        },
      },
    };
    let nextCalled = false;
    let nextError;

    await checkMemberSession(req, {}, error => {
      nextCalled = true;
      nextError = error;
    });

    assert.equal(nextCalled, true);
    should.not.exist(nextError);
    assert.equal(req.session.memberActivityEventId, eventId);
    assert.equal(updateActivity.callCount, 2);
  });

  it('passes storage failures and a missing record to error handling', async function () {
    const storageError = new Error('storage unavailable');
    const failedWrite = await runMiddleware(null, {
      upsertError: storageError,
    });
    assert.equal(failedWrite.nextError, storageError);

    sinon.restore();
    const missingRecord = await runMiddleware(null);
    assert(missingRecord.nextError instanceof Error);
    assert.equal(
      missingRecord.nextError.message,
      'Member session record disappeared.',
    );
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
          lastSeenAt: new Date(now - 7 * 86400000),
        }),
      },
      {
        record: activeSessionRecord({ user: new mongoose.Types.ObjectId() }),
        requestUserId: new mongoose.Types.ObjectId(),
      },
      { record: activeSessionRecord({ authVersion: 1 }) },
    ];

    for (const testCase of testCases) {
      sinon.useFakeTimers({ now, toFake: ['Date'] });
      const result = await runMiddleware(testCase.record, testCase);
      assert.equal(result.options.destroyed, true);
      assert.equal(result.req.user, undefined);
      result.nextCalled.should.equal(true);
      should.not.exist(result.nextError);
      sinon.restore();
    }
  });

  it('refreshes activity at one minute only for the matching active session', async function () {
    const now = Date.now();
    const authVersion = 3;
    const id = sessionId('opaque-session-id');
    sinon.useFakeTimers({ now, toFake: ['Date'] });
    const freshRecord = activeSessionRecord({
      authVersion,
      lastSeenAt: new Date(now - 59999),
    });
    const fresh = await runMiddleware(freshRecord, { authVersion });
    assert.equal(fresh.nextCalled, true);
    assert.equal(fresh.nextError, undefined);
    assert.equal(fresh.activityUpdater.callCount, 0);

    sinon.restore();
    sinon.useFakeTimers({ now, toFake: ['Date'] });
    const record = activeSessionRecord({
      authVersion,
      lastSeenAt: new Date(now - 60000),
    });
    const refreshed = await runMiddleware(record, { authVersion });
    assert.equal(refreshed.nextCalled, true);
    assert.equal(refreshed.nextError, undefined);
    assert.equal(refreshed.options.destroyed, undefined);
    assert.equal(refreshed.req.user._id, record.user);
    assert.equal(refreshed.sessionUpserter.callCount, 1);
    assert.deepEqual(refreshed.sessionUpserter.firstCall.args, [
      { _id: id },
      {
        $setOnInsert: {
          user: record.user,
          authVersion,
          createdAt: new Date(now),
          lastSeenAt: new Date(now),
          expiresAt: new Date(now + sessionLifetimes().absolute),
        },
      },
      { upsert: true },
    ]);
    assert.equal(refreshed.activityUpdater.callCount, 1);
    assert.deepEqual(refreshed.activityUpdater.firstCall.args, [
      {
        _id: id,
        user: record.user,
        authVersion,
        revoked: false,
        expiresAt: { $gt: new Date(now) },
      },
      { $set: { lastSeenAt: new Date(now) } },
      { new: true },
    ]);
  });

  it('destroys a session revoked during activity refresh', async function () {
    const record = activeSessionRecord({
      lastSeenAt: new Date(Date.now() - 61000),
    });
    const revokedDuringRefresh = await runMiddleware(record, {
      updatedRecord: null,
    });
    assert.equal(revokedDuringRefresh.options.destroyed, true);
    assert.equal(revokedDuringRefresh.req.user, undefined);
  });

  it('forwards failures while destroying a session', async function () {
    const destroyError = new Error('session store unavailable');
    const invalidSession = await runMiddleware(
      activeSessionRecord({ revoked: true }),
      { destroyError },
    );
    assert.equal(invalidSession.nextError, destroyError);

    sinon.restore();
    const result = await runMiddleware(
      activeSessionRecord({ lastSeenAt: new Date(Date.now() - 61000) }),
      { updatedRecord: null, destroyError },
    );
    assert.equal(result.nextError, destroyError);
  });

  it('handles controller validation, storage errors, and current-session revoke', async function () {
    const userId = new mongoose.Types.ObjectId();
    const user = { _id: userId, authVersion: 0, roles: ['user'] };
    const req: Parameters<typeof sessionsController.confirmPassword>[0] = {
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
    assert.deepEqual(res.body, { message: 'Sign in to manage your sessions.' });
    res.headers['Cache-Control'].should.equal('no-store');
    res.headers.vary.should.equal('Cookie');
    next.called.should.equal(false);
    sessionsController.requireMember(req, res, next.next);
    next.called.should.equal(true);

    sinon.stub(MemberSession, 'find').throws(new Error('list failed'));
    next = createNext();
    await sessionsController.list(req, createResponse(), next.next);
    assert.equal(next.error?.message, 'list failed');
    sinon.restore();

    const passwordLookup = sinon.stub(User, 'findById');
    for (const body of [
      undefined,
      {},
      { password: 42 },
      { password: 'x'.repeat(1025) },
    ]) {
      res = createResponse();
      next = createNext();
      await sessionsController.confirmPassword(
        { ...req, body },
        res,
        next.next,
      );
      res.statusCode.should.equal(400);
      assert.deepEqual(res.body, { message: 'Enter your current password.' });
      assert.equal(next.called, false);
    }
    assert.equal(passwordLookup.callCount, 0);
    sinon.restore();

    const password = 'x'.repeat(1024);
    const authenticate = sinon.stub().resolves(true);
    sinon.stub(User, 'findById').resolves({ authVersion: 3, authenticate });
    next = createNext();
    await sessionsController.confirmPassword(
      { ...req, user: { ...user, authVersion: 3 }, body: { password } },
      createResponse(),
      next.next,
    );
    sinon.assert.calledOnceWithExactly(authenticate, password);
    assert.equal(next.called, true);
    assert.equal(next.error, undefined);
    sinon.restore();

    sinon.stub(User, 'findById').resolves(null);
    res = createResponse();
    await sessionsController.confirmPassword(
      { ...req, body: { password: 'valid' } },
      res,
      () => {},
    );
    res.statusCode.should.equal(400);
    assert.deepEqual(res.body, { message: 'Current password is incorrect.' });
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
    assert.deepEqual(res.body, { message: 'Sign in again.' });
    sinon.restore();

    sinon.stub(User, 'findById').throws(new Error('password lookup failed'));
    next = createNext();
    await sessionsController.confirmPassword(
      { ...req, body: { password: 'valid' } },
      createResponse(),
      next.next,
    );
    assert.equal(next.error?.message, 'password lookup failed');
    sinon.restore();

    const invalidRevoke = sinon.stub(MemberSession, 'findOneAndUpdate');
    for (const id of ['bad', 'x' + 'a'.repeat(64), 'a'.repeat(64) + 'x']) {
      res = createResponse();
      await sessionsController.revoke(
        { ...req, params: { id } },
        res,
        () => {},
      );
      res.statusCode.should.equal(404);
    }
    assert.equal(invalidRevoke.callCount, 0);
    sinon.restore();

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
    assert.equal(next.error?.message, 'revoke destroy failed');
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
    assert.equal(next.error?.message, 'revoke failed');
    sinon.restore();

    sinon.stub(User, 'updateOne').throws(new Error('version update failed'));
    next = createNext();
    await sessionsController.revokeAll(req, createResponse(), next.next);
    assert.equal(next.error?.message, 'version update failed');
    sinon.restore();

    sinon.stub(User, 'updateOne').resolves();
    sinon
      .stub(MemberSession, 'updateMany')
      .throws(new Error('revoke all failed'));
    next = createNext();
    await sessionsController.revokeAll(req, createResponse(), next.next);
    assert.equal(next.error?.message, 'revoke all failed');
    sinon.restore();

    sinon.stub(User, 'updateOne').resolves();
    sinon.stub(MemberSession, 'updateMany').resolves();
    req.session.destroy = callback => callback(new Error('destroy failed'));
    next = createNext();
    await sessionsController.revokeAll(req, createResponse(), next.next);
    assert.equal(next.error?.message, 'destroy failed');
    sinon.restore();

    req.session.destroy = callback => callback();
    res = createResponse();
    await sessionsController.revokeAll(req, res, () => {});
    res.statusCode.should.equal(204);
  });

  async function createMember(suffix = '') {
    const credentials = {
      username: 'sessioncontrolmember' + suffix,
      password: 'ExamplePassword123!',
    };
    const user = await new User({
      ...credentials,
      firstName: 'Example',
      lastName: 'Member',
      email: `session-control${suffix}@example.test`,
      provider: 'local',
      roles: ['user'],
    }).save();
    return { credentials, user };
  }

  async function signIn(
    agent: TestAgent,
    credentials: { username: string; password: string },
  ) {
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    return agent.get('/api/auth/sessions').expect(200);
  }

  it('lists only the member’s opaque active sessions and marks the current one', async function () {
    const { credentials, user } = await createMember();
    await User.updateOne({ _id: user._id }, { $set: { authVersion: 3 } });
    const current = request.agent(app);
    const other = request.agent(app);
    const currentList = await signIn(current, credentials);
    const otherList = await signIn(other, credentials);
    const oldRecord = activeSessionRecord({ user: user._id });
    await MemberSession.insertMany([
      {
        ...oldRecord,
        _id: 'c'.repeat(64),
        lastSeenAt: new Date(Date.now() - 8 * 86400000),
      },
      {
        ...oldRecord,
        _id: 'd'.repeat(64),
        user: new mongoose.Types.ObjectId(),
      },
      { ...oldRecord, _id: 'e'.repeat(64), authVersion: 1 },
      { ...oldRecord, _id: 'f'.repeat(64), revoked: true },
    ]);
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
    assert.equal(otherList.body[0].current, true);
    assert.notEqual(otherList.body[0].id, currentList.body[0].id);
    assert.deepEqual(
      refreshedCurrentList.body.map((session: { id: string }) => session.id),
      [otherList.body[0].id, currentList.body[0].id],
    );
    const recorded = await MemberSession.findById(
      currentList.body[0].id,
    ).orFail();
    assert.equal(
      currentList.body[0].createdAt,
      recorded.createdAt.toISOString(),
    );
    assert.equal(
      currentList.body[0].lastSeenAt,
      recorded.lastSeenAt.toISOString(),
    );

    const anonymous = await request(app).get('/api/auth/sessions').expect(403);
    anonymous.headers['cache-control'].should.equal('no-store');
    anonymous.headers.vary.should.match(/Cookie/);
  });

  it('requires the current password and revokes the selected session', async function () {
    const { credentials, user } = await createMember();
    const current = request.agent(app);
    const other = request.agent(app);
    await signIn(current, credentials);
    await signIn(other, credentials);
    const allSessions = await current.get('/api/auth/sessions').expect(200);
    const otherSession = allSessions.body.find(
      (session: { current: boolean }) => !session.current,
    );

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
    (
      await AccountActivity.countDocuments({
        user: user._id,
        eventType: 'session_revoked',
      })
    ).should.equal(1);
    (await other.get('/api/users/export').expect(403)).status.should.equal(403);
    (await current.get('/api/users/export').expect(200)).status.should.equal(
      200,
    );
  });

  it('increments the authentication version and signs out every session', async function () {
    const foreign = await createMember('other');
    const foreignAgent = request.agent(app);
    const foreignList = await signIn(foreignAgent, foreign.credentials);
    const foreignSessionId = foreignList.body[0].id;
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
    const untouchedMember = await User.findById(foreign.user._id).orFail();
    assert.equal(untouchedMember.authVersion, 0);
    const untouchedSession =
      await MemberSession.findById(foreignSessionId).orFail();
    assert.equal(untouchedSession.revoked, false);
    await foreignAgent.get('/api/auth/sessions').expect(200);

    (
      await MemberSession.countDocuments({ user: user._id, revoked: true })
    ).should.equal(2);
    (
      await AccountActivity.countDocuments({
        user: user._id,
        eventType: 'sessions_signed_out',
      })
    ).should.equal(1);
    const currentSession = await current.get('/api/auth/session').expect(200);
    should(currentSession.body.userId).equal(null);
    (await other.get('/api/users/export').expect(403)).status.should.equal(403);
  });
});
