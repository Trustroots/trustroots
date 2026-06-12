/**
 * Unit tests for the push-registration and tribe-membership handlers of the
 * profile controller. These are exercised directly with mock req/res objects
 * against the test database; the push notification service is stubbed via
 * proxyquire so no notifications are actually sent.
 */
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');
const sinon = require('sinon');

const profileController = require('../../server/controllers/users.profile.server.controller');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

const User = mongoose.model('User');

const controllerPath =
  '../../server/controllers/users.profile.server.controller';
const pushServicePath = '../../../core/server/services/push.server.service';

/**
 * Load the profile controller with the push notification service stubbed.
 *
 * @param {Function} notifyPushDeviceAdded - stub for the notify call
 */
function loadControllerWithPush(notifyPushDeviceAdded) {
  return proxyquire(controllerPath, {
    [pushServicePath]: { notifyPushDeviceAdded },
  });
}

function deferredResponse() {
  let resolveResponse;
  const promise = new Promise(resolve => {
    resolveResponse = resolve;
  });

  const res = { statusCode: 200, body: null };
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.send = function (body) {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.json = function (body) {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.waitForResponse = () => promise;
  return res;
}

describe('Profile controller push/membership unit tests', () => {
  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  describe('getUserMemberships', () => {
    it('responds with 403 when there is no user', async () => {
      const res = deferredResponse();
      profileController.getUserMemberships({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('returns the list of memberships', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      profileController.getUserMemberships({ user: { _id: saved._id } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.should.be.an.Array();
      res.body.length.should.equal(0);
    });

    it('returns 400 when loading memberships fails', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      sinon.stub(User, 'findById').returns({
        populate() {
          return this;
        },
        exec(cb) {
          cb(new Error('db error'));
        },
      });

      const res = deferredResponse();
      profileController.getUserMemberships({ user: { _id: saved._id } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Failed to get list of tribes.');
    });
  });

  describe('removePushRegistration', () => {
    it('responds with 403 when there is no user', async () => {
      const res = deferredResponse();
      profileController.removePushRegistration({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('returns 400 when removing a registration fails', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      sinon.stub(User, 'findByIdAndUpdate').returns({
        exec: cb => cb(new Error('remove failed')),
      });

      const res = deferredResponse();
      profileController.removePushRegistration(
        { user: { _id: saved._id }, params: { token: 'token-1' } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('removes a registration by token', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.pushRegistration = [{ platform: 'web', token: 'token-1' }];
      await userDoc.save();

      const res = deferredResponse();
      profileController.removePushRegistration(
        { user: { _id: saved._id }, params: { token: 'token-1' } },
        res,
      );
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      res.body.message.should.equal('Removed registration.');

      const reloaded = await User.findById(saved._id);
      reloaded.pushRegistration.length.should.equal(0);
    });
  });

  describe('addPushRegistration', () => {
    it('responds with 403 when there is no user', async () => {
      const res = deferredResponse();
      profileController.addPushRegistration({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('responds with 400 when the token is missing', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      profileController.addPushRegistration(
        { user: { _id: saved._id }, body: { platform: 'web' } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Token is invalid or missing.');
    });

    it('responds with 400 when the platform is invalid', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      profileController.addPushRegistration(
        {
          user: { _id: saved._id },
          body: { token: 'token-1', platform: 'nokia' },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Platform is invalid or missing.');
    });

    it('saves a registration without notifying when doNotNotify is set', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      profileController.addPushRegistration(
        {
          user: { _id: saved._id },
          body: { token: 'token-1', platform: 'web', doNotNotify: true },
        },
        res,
      );
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      res.body.message.should.equal('Saved registration.');

      const reloaded = await User.findById(saved._id);
      reloaded.pushRegistration.length.should.equal(1);
      reloaded.pushRegistration[0].token.should.equal('token-1');
    });

    it('saves a registration and notifies the user', async () => {
      let notified = false;
      const controller = loadControllerWithPush((user, platform, cb) => {
        notified = true;
        cb();
      });

      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      controller.addPushRegistration(
        {
          user: { _id: saved._id },
          body: { token: 'token-2', platform: 'web' },
        },
        res,
      );
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      res.body.message.should.equal('Saved registration.');
      notified.should.be.true();
    });

    it('returns 400 when saving the registration fails', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      sinon
        .stub(User, 'findByIdAndUpdate')
        .onFirstCall()
        .returns({ exec: cb => cb() })
        .onSecondCall()
        .returns({
          exec: cb => cb(new Error('save failed')),
        });

      const res = deferredResponse();
      profileController.addPushRegistration(
        {
          user: { _id: saved._id },
          body: { token: 'token-fail', platform: 'web' },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('still succeeds when the notification fails', async () => {
      const controller = loadControllerWithPush((user, platform, cb) =>
        cb(new Error('push failed')),
      );

      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      controller.addPushRegistration(
        {
          user: { _id: saved._id },
          body: { token: 'token-3', platform: 'android', deviceId: 'device-1' },
        },
        res,
      );
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      res.body.message.should.equal('Saved registration.');
    });
  });
});
