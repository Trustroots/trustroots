/**
 * Unit tests for password controller validation and reset branches.
 */
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

const utils = require('../../../../testutils/server/data.server.testutil');
const testutils = require('../../../../testutils/server/server.testutil');
require('should');

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
          body: { newPassword: 'newpass', verifyPassword: 'newpass' },
          login: (user, cb) => cb(new Error('login failed')),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
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
  });
});
