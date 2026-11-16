const assert = require('node:assert/strict');
const sinon = require('sinon');
const passkeys =
  require('../../server/services/passkey.server.service.mjs').default;
const profile = require('../../server/controllers/users.profile.server.controller.mjs');
const controller =
  require('../../server/controllers/users.passkeys.server.controller.mjs').default;

describe('Passkey HTTP responses', function () {
  afterEach(() => sinon.restore());
  function response() {
    return {
      statusCode: 200,
      set: sinon.spy(),
      vary: sinon.spy(),
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
  }
  for (const operation of [
    'list',
    'registrationOptions',
    'register',
    'authenticationOptions',
    'remove',
  ]) {
    it('returns a private ' + operation + ' response', async function () {
      const result = { accepted: true };
      sinon.stub(passkeys, operation).resolves(result);
      const res = response();
      await controller[operation]({}, res);
      assert.equal(res.body, result);
      assert(res.set.calledWith('Cache-Control', 'no-store'));
      assert(res.vary.calledWith('Cookie'));
    });
  }
  it('establishes a session only after successful verification', async function () {
    const user = {
      _id: 'fictional-member',
      username: 'fictional-member',
      mfaEnabled: true,
      $locals: { mfaVerified: true },
    };
    sinon.stub(passkeys, 'authenticate').resolves(user);
    sinon.stub(profile, 'sanitizeOwnProfile').returns({ _id: user._id });
    const req = { login: sinon.spy((member, callback) => callback(null)) };
    const res = response();
    await controller.authenticate(req, res);
    assert(req.login.calledWith(user));
    assert.deepEqual(res.body, { _id: user._id });
    req.login = (member, callback) => callback(new Error('fictional failure'));
    await controller.authenticate(req, res);
    assert.equal(res.statusCode, 503);
  });
  it('returns actionable validation errors and hides verifier internals', async function () {
    const stub = sinon
      .stub(passkeys, 'register')
      .rejects(Object.assign(new Error('Try again.'), { status: 403 }));
    const res = response();
    await controller.register({}, res);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { message: 'Try again.' });
    stub.rejects(new Error('private verifier details'));
    await controller.register({}, res);
    assert.equal(res.statusCode, 400);
    assert.equal(
      res.body.message,
      'Passkey request was not accepted. Try again.',
    );
  });
});
