import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import sinon from 'sinon';
import 'should';
import config from '../../../../config/config.mts';
import express from '../../../../config/lib/express.mts';
import * as utils from '../../../../testutils/server/data.server.testutil.mts';
import {
  confirmAdminPassword,
  elevationLifetimeMs,
  isAdminElevated,
} from '../../server/services/admin-elevation.server.service.mts';

describe('Admin elevation route tests', () => {
  let app: Awaited<ReturnType<typeof express.init>>;
  const usersRaw = utils.generateUsers(2);
  usersRaw[0].roles = ['user', 'admin'];
  usersRaw[1].roles = ['user'];

  before(async function () {
    app = await express.init(mongoose.connection);
  });

  beforeEach(async () => {
    await utils.saveUsers(usersRaw);
  });
  afterEach(utils.clearDatabase);
  afterEach(() => sinon.restore());

  it('uses a half-hour default when no elevation lifetime is configured', () => {
    sinon.stub(config, 'adminElevation').value(undefined);
    elevationLifetimeMs().should.equal(30 * 60 * 1000);
  });

  it('expires elevation at the configured deadline', () => {
    sinon.stub(config, 'adminElevation').value({ lifetimeMs: 1200 });
    const now = 100000;
    assert.equal(isAdminElevated(undefined, now), false);
    assert.equal(isAdminElevated({ adminElevatedAt: Infinity }, now), false);
    assert.equal(isAdminElevated({ adminElevatedAt: now - 1199 }, now), true);
    assert.equal(isAdminElevated({ adminElevatedAt: now - 1200 }, now), false);
  });

  it('keeps the member signed in while requiring password step-up for admin APIs', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/signin')
      .send({
        username: usersRaw[0].username,
        password: usersRaw[0].password,
      })
      .expect(200);

    const blocked = await agent.get('/api/admin/dashboard').expect(403);
    assert.deepEqual(blocked.body, {
      code: 'ADMIN_ELEVATION_REQUIRED',
      message: 'Enter your password to continue with admin tools.',
    });
    assert.equal(blocked.headers['cache-control'], 'no-store');
    assert.match(blocked.headers.vary, /\bCookie\b/);

    await agent
      .post('/api/admin/elevate')
      .set('X-Trustroots-Request', '1')
      .send({})
      .expect(400);
    await agent
      .post('/api/admin/elevate')
      .set('X-Trustroots-Request', '1')
      .send({ password: '' })
      .expect(400);
    await agent
      .post('/api/admin/elevate')
      .set('X-Trustroots-Request', '1')
      .send({ password: 'x'.repeat(1025) })
      .expect(400, { message: 'Enter your current password.' });

    await agent
      .post('/api/admin/elevate')
      .set('X-Trustroots-Request', '1')
      .send({ password: 'x'.repeat(1024) })
      .expect(400, { message: 'Current password is incorrect.' });

    const earliestExpiry = Date.now() + elevationLifetimeMs();
    const elevated = await agent
      .post('/api/admin/elevate')
      .set('X-Trustroots-Request', '1')
      .send({ password: usersRaw[0].password })
      .expect(200);
    const expiry = Date.parse(elevated.body.elevatedUntil);
    assert(expiry >= earliestExpiry);
    assert(expiry <= Date.now() + elevationLifetimeMs());

    const dashboard = await agent.get('/api/admin/dashboard').expect(200);
    assert.equal(dashboard.headers['cache-control'], 'no-store');
    assert.match(dashboard.headers.vary, /\bCookie\b/);

    const session = await agent.get('/api/auth/session').expect(200);
    session.body.userId.should.be.ok();
  });

  it('does not elevate regular members', async () => {
    const agent = request.agent(app);
    await utils.signIn(
      {
        username: usersRaw[1].username,
        password: usersRaw[1].password,
      },
      agent,
    );
    await agent
      .post('/api/admin/elevate')
      .set('X-Trustroots-Request', '1')
      .send({ password: usersRaw[1].password })
      .expect(403);
    await agent.get('/api/admin/dashboard').expect(403);
  });

  it('requires a valid password and the current member authentication version', async () => {
    const user = await mongoose
      .model('User')
      .findOne({ username: usersRaw[0].username })
      .orFail();
    await mongoose
      .model('User')
      .updateOne({ _id: user._id }, { $inc: { authVersion: 1 } });

    const res = {
      statusCode: 200,
      body: undefined as { message: string } | undefined,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(body: { message: string }) {
        this.body = body;
        return this;
      },
    };
    const next = sinon.spy();
    const member = { _id: user._id, authVersion: 1 };

    for (const body of [undefined, { password: 123 }]) {
      await confirmAdminPassword({ body, user: member }, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.message, 'Enter your current password.');
    }

    const body = { password: usersRaw[0].password };
    await confirmAdminPassword(
      { body, user: { ...member, authVersion: 0 } },
      res,
      next,
    );
    assert.equal(res.statusCode, 403);
    assert.equal(res.body?.message, 'Sign in again.');
    sinon.assert.notCalled(next);

    await confirmAdminPassword({ body, user: member }, res, next);
    sinon.assert.calledOnceWithExactly(next);
  });

  it('forwards account lookup errors while confirming the password', async () => {
    const res = {
      status() {
        return this;
      },
      json() {
        return this;
      },
    };
    let nextError: unknown;
    await confirmAdminPassword(
      { body: { password: 'Password123!' }, user: { _id: 'not-an-id' } },
      res,
      error => {
        nextError = error;
      },
    );
    assert(nextError instanceof Error);
  });
});
