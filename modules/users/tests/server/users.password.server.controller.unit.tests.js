/**
 * Unit tests for password controller validation and reset branches.
 */
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');
const sinon = require('sinon');

const utils = require('../../../../testutils/server/data.server.testutil');
const testutils = require('../../../../testutils/server/server.testutil');
const should = require('should');

const User = mongoose.model('User');

const controllerPath =
  '../../server/controllers/users.password.server.controller';
const emailServicePath = '../../../core/server/services/email.server.service';

function deferredResponse() {
  let resolveResponse;
  const promise = new Promise(resolve => {
    resolveResponse = resolve;
  });
  const res = {
    statusCode: 200,
    body: null,
    redirectUrl: null,
  };
  res.status = code => {
    res.statusCode = code;
    return res;
  };
  res.send = body => {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.json = body => {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.redirect = url => {
    res.redirectUrl = url;
    resolveResponse(res);
    return res;
  };
  res.waitForResponse = () => promise;
  return res;
}

function loadPasswordController() {
  return proxyquire(controllerPath, {
    [emailServicePath]: {
      sendResetPassword: (user, cb) => cb(),
      sendResetPasswordConfirm: (user, cb) => cb(),
    },
  });
}

describe('Password controller unit tests', () => {
  const jobs = testutils.catchJobs();

  afterEach(async () => {
    sinon.restore();
    jobs.length = 0;
    await utils.clearDatabase();
  });

  describe('forgot', () => {
    it('requires a username or email', async () => {
      const controller = loadPasswordController();
      const res = deferredResponse();
      controller.forgot({ body: {} }, res, () => {});
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns 404 when the account does not exist', async () => {
      const controller = loadPasswordController();
      const res = deferredResponse();
      controller.forgot({ body: { username: 'nobody-here' } }, res, () => {});
      await res.waitForResponse();
      res.statusCode.should.equal(404);
    });

    it('returns 400 when sending the reset email fails', async () => {
      const controller = proxyquire(controllerPath, {
        [emailServicePath]: {
          sendResetPassword: (user, cb) => cb(new Error('smtp down')),
        },
      });
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      const res = deferredResponse();
      controller.forgot(
        { body: { username: userDoc.username } },
        res,
        () => {},
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('sends a reset email for a valid account', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      const res = deferredResponse();
      controller.forgot(
        { body: { username: userDoc.username } },
        res,
        () => {},
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.message.should.containEql('sent you an email');
    });

    it('propagates errors when saving the reset token fails', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);

      sinon.stub(User, 'findOne').callsFake(function (query, fields, cb) {
        cb(null, {
          email: userDoc.email,
          username: userDoc.username,
          save(saveCb) {
            saveCb(new Error('save failed'));
          },
        });
      });

      let nextErr;
      const res = deferredResponse();
      await new Promise(resolve => {
        controller.forgot(
          { body: { username: userDoc.username } },
          res,
          err => {
            nextErr = err;
            resolve();
          },
        );
      });

      should.exist(nextErr);
      nextErr.message.should.equal('save failed');
    });
  });

  describe('validateResetToken', () => {
    it('redirects invalid tokens to the invalid page', async () => {
      const controller = loadPasswordController();
      const res = deferredResponse();
      controller.validateResetToken({ params: { token: 'bad-token' } }, res);
      await res.waitForResponse();
      res.redirectUrl.should.equal('/password/reset/invalid');
    });

    it('redirects valid tokens to the reset form', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.resetPasswordToken = 'valid-token';
      userDoc.resetPasswordExpires = Date.now() + 3600000;
      await userDoc.save();

      const res = deferredResponse();
      controller.validateResetToken({ params: { token: 'valid-token' } }, res);
      await res.waitForResponse();
      res.redirectUrl.should.equal('/password/reset/valid-token');
    });

    it('preserves UTM parameters on valid token redirects', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.resetPasswordToken = 'valid-token';
      userDoc.resetPasswordExpires = Date.now() + 3600000;
      await userDoc.save();

      const res = deferredResponse();
      controller.validateResetToken(
        {
          params: { token: 'valid-token' },
          query: {
            utm_source: 'newsletter',
            utm_medium: 'email',
            utm_campaign: 'reset',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.redirectUrl.should.containEql('/password/reset/valid-token');
      res.redirectUrl.should.containEql('utm_source=newsletter');
      res.redirectUrl.should.containEql('utm_medium=email');
      res.redirectUrl.should.containEql('utm_campaign=reset');
    });
  });

  describe('reset', () => {
    it('rejects an invalid token', async () => {
      const controller = loadPasswordController();
      const res = deferredResponse();
      controller.reset(
        {
          params: { token: 'missing' },
          body: { newPassword: 'newpass', verifyPassword: 'newpass' },
          login: () => {},
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('resets the password and logs the user in', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.resetPasswordToken = 'reset-token';
      userDoc.resetPasswordExpires = Date.now() + 3600000;
      await userDoc.save();

      const res = deferredResponse();
      controller.reset(
        {
          params: { token: 'reset-token' },
          body: {
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.username.should.equal(userDoc.username);
    });

    it('returns 400 when login fails after reset', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.resetPasswordToken = 'reset-token';
      userDoc.resetPasswordExpires = Date.now() + 3600000;
      await userDoc.save();

      const res = deferredResponse();
      controller.reset(
        {
          params: { token: 'reset-token' },
          body: {
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(new Error('login failed')),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns 400 when saving the reset password fails', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.resetPasswordToken = 'reset-token';
      userDoc.resetPasswordExpires = Date.now() + 3600000;
      await userDoc.save();

      sinon.stub(User, 'findOne').callsFake((query, cb) => {
        cb(null, {
          password: null,
          resetPasswordToken: userDoc.resetPasswordToken,
          resetPasswordExpires: userDoc.resetPasswordExpires,
          save: saveCb => saveCb(new Error('save failed')),
        });
      });

      const res = deferredResponse();
      controller.reset(
        {
          params: { token: 'reset-token' },
          body: {
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Password reset failed.');
    });

    it('rejects mismatched passwords', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.resetPasswordToken = 'reset-token';
      userDoc.resetPasswordExpires = Date.now() + 3600000;
      await userDoc.save();

      const res = deferredResponse();
      controller.reset(
        {
          params: { token: 'reset-token' },
          body: { newPassword: 'newpass', verifyPassword: 'different' },
          login: () => {},
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Passwords do not match.');
    });

    it('still resets the password when the confirmation email fails', async () => {
      const controller = proxyquire(controllerPath, {
        [emailServicePath]: {
          sendResetPassword: (user, cb) => cb(),
          sendResetPasswordConfirm: (user, cb) =>
            cb(new Error('confirm email failed')),
        },
      });
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.resetPasswordToken = 'reset-token';
      userDoc.resetPasswordExpires = Date.now() + 3600000;
      await userDoc.save();

      const res = deferredResponse();
      controller.reset(
        {
          params: { token: 'reset-token' },
          body: {
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.username.should.equal(userDoc.username);
    });

    it('ignores a successful final reset callback', () => {
      const controller = proxyquire(controllerPath, {
        async: {
          waterfall(steps, done) {
            done();
          },
        },
      });
      const res = {
        status: sinon.stub().returnsThis(),
        send: sinon.stub(),
        json: sinon.stub(),
      };

      controller.reset(
        {
          params: { token: 'reset-token' },
          body: {
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(),
        },
        res,
      );

      res.status.called.should.be.false();
      res.send.called.should.be.false();
      res.json.called.should.be.false();
    });
  });

  describe('changePassword', () => {
    it('responds with 403 without a user', async () => {
      const controller = loadPasswordController();
      const res = deferredResponse();
      controller.changePassword({ body: {} }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('requires a new password', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      controller.changePassword(
        { user: { id: saved._id.toString() }, body: {} },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('rejects mismatched new passwords', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: saved._id.toString() },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'different-password',
          },
          login: () => {},
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Passwords do not match.');
    });

    it('rejects an incorrect current password', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.password = 'oldpassword1';
      await userDoc.save();

      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: saved._id.toString() },
          body: {
            currentPassword: 'wrong-password',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: () => {},
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Current password is incorrect.');
    });

    it('changes the password for a valid user', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.password = 'oldpassword1';
      await userDoc.save();

      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: saved._id.toString() },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.message.should.equal('Password changed successfully!');
    });

    it('returns 400 when login fails after changing the password', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.password = 'oldpassword1';
      await userDoc.save();

      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: saved._id.toString() },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(new Error('login failed')),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('login failed');
    });

    it('returns 400 when the password change confirmation email fails', async () => {
      const controller = proxyquire(controllerPath, {
        [emailServicePath]: {
          sendResetPassword: (user, cb) => cb(),
          sendResetPasswordConfirm: (user, cb) =>
            cb(new Error('confirm email failed')),
        },
      });
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.password = 'oldpassword1';
      await userDoc.save();

      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: saved._id.toString() },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('confirm email failed');
    });
  });
});
