const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const sinon = require('sinon');

require('should');
require('../../server/models/user.server.model.mjs');

const profileController = require('../../server/controllers/users.profile.server.controller.mjs');
const User = mongoose.model('User');
const userId = new mongoose.Types.ObjectId();
const email = 'pending-member@example.test';

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function query(result) {
  return { exec: async () => result };
}

function signedIn(overrides = {}) {
  return {
    _id: userId,
    email: 'current-member@example.test',
    public: true,
    authVersion: 0,
    ...overrides,
  };
}

function currentAccount(overrides = {}) {
  return {
    ...signedIn(),
    emailTemporary: email,
    emailToken: 'snapshot-token',
    toObject() {
      return { ...this };
    },
    ...overrides,
  };
}

function stubSanitizer() {
  sinon
    .stub(profileController, 'sanitizeOwnProfile')
    .callsFake(user => ({ emailTemporary: user.emailTemporary }));
}

describe('Email change snapshot cancellation controller unit tests', () => {
  afterEach(() => sinon.restore());

  it('returns 409 without clearing a replacement when the signed-in snapshot has no pending address', async () => {
    const replacement = currentAccount({
      emailTemporary: email,
      emailToken: 'replacement-token',
    });
    sinon.stub(User, 'findOneAndUpdate').throws(new Error('unexpected CAS'));
    sinon.stub(User, 'findOne').returns(query(replacement));
    const res = response();

    await profileController.cancelEmailChange(
      { user: signedIn({ emailTemporary: '', emailToken: '' }) },
      res,
    );

    assert.equal(res.statusCode, 409);
    assert.equal(replacement.emailTemporary, email);
    assert.equal(replacement.emailToken, 'replacement-token');
    assert.equal(User.findOneAndUpdate.called, false);
  });

  for (const token of [undefined, '']) {
    it(`preserves a pending change and returns 409 when the snapshot token is ${
      token === undefined ? 'absent' : 'empty'
    }`, async () => {
      const user = currentAccount({ emailToken: token });
      sinon.stub(User, 'findOneAndUpdate').throws(new Error('unexpected CAS'));
      sinon.stub(User, 'findOne').returns(query(user));
      stubSanitizer();
      const res = response();

      await profileController.cancelEmailChange(
        { user: signedIn({ emailTemporary: email, emailToken: token }) },
        res,
      );

      assert.equal(res.statusCode, 409);
      assert.equal(user.emailToken, token);
      assert.equal(user.emailTemporary, email);
      assert.equal(User.findOneAndUpdate.called, false);
    });
  }

  it('returns the current profile idempotently when no pending change remains', async () => {
    const user = currentAccount({
      emailTemporary: undefined,
      emailToken: undefined,
    });
    sinon.stub(User, 'findOneAndUpdate').returns(query(null));
    sinon.stub(User, 'findOne').returns(query(user));
    stubSanitizer();
    const res = response();

    await profileController.cancelEmailChange(
      {
        user: signedIn({ emailTemporary: email, emailToken: 'snapshot-token' }),
      },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.emailTemporary, undefined);
    assert.equal(user.emailTemporary, undefined);
    assert.equal(User.findOneAndUpdate.called, true);
    assert.equal(User.findOne.called, true);
  });

  it('cancels a matching non-zero authentication-version snapshot', async () => {
    const user = currentAccount({ authVersion: 7, emailTemporary: undefined });
    const update = sinon.stub(User, 'findOneAndUpdate').returns(query(user));
    stubSanitizer();
    const res = response();

    await profileController.cancelEmailChange(
      {
        user: signedIn({
          authVersion: 7,
          emailTemporary: email,
          emailToken: 'snapshot-token',
        }),
      },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(update.firstCall.args[0].$and, [{ authVersion: 7 }]);
    assert.equal(res.body.emailTemporary, undefined);
  });

  it('preserves a replacement token and returns 409 when the address matches but token changed', async () => {
    const replacement = currentAccount({ emailToken: 'replacement-token' });
    sinon.stub(User, 'findOneAndUpdate').returns(query(null));
    sinon.stub(User, 'findOne').returns(query(replacement));
    const res = response();

    await profileController.cancelEmailChange(
      {
        user: signedIn({
          emailTemporary: email,
          emailToken: 'snapshot-token',
        }),
      },
      res,
    );

    assert.equal(res.statusCode, 409);
    assert.equal(replacement.emailTemporary, email);
    assert.equal(replacement.emailToken, 'replacement-token');
    assert.match(res.body.message, /changed/i);
  });

  it('preserves the pending change and returns 409 when its authentication version changed', async () => {
    const replacement = currentAccount({ authVersion: 9 });
    sinon.stub(User, 'findOneAndUpdate').returns(query(null));
    sinon.stub(User, 'findOne').returns(query(replacement));
    const res = response();

    await profileController.cancelEmailChange(
      {
        user: signedIn({
          authVersion: 8,
          emailTemporary: email,
          emailToken: 'snapshot-token',
        }),
      },
      res,
    );

    assert.equal(res.statusCode, 409);
    assert.equal(replacement.emailTemporary, email);
    assert.equal(replacement.emailToken, 'snapshot-token');
  });

  it('cancels a legacy snapshot without an authentication version', async () => {
    const legacyUser = currentAccount({
      authVersion: undefined,
      emailTemporary: undefined,
    });
    const update = sinon
      .stub(User, 'findOneAndUpdate')
      .returns(query(legacyUser));
    stubSanitizer();
    const res = response();

    await profileController.cancelEmailChange(
      {
        user: signedIn({
          authVersion: undefined,
          emailTemporary: email,
          emailToken: 'snapshot-token',
        }),
      },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(update.firstCall.args[0].$and, [
      {
        $or: [{ authVersion: { $exists: false } }, { authVersion: 0 }],
      },
    ]);
    assert.equal(res.body.emailTemporary, undefined);
  });
});
