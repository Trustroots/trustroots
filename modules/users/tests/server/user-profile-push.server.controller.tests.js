/**
 * Unit tests for the push-registration and tribe-membership handlers of the
 * profile controller. These are exercised directly with mock req/res objects
 * against the test database.
 */
const mongoose = require('mongoose');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

require('../../server/models/user.server.model');
require('../../../contacts/server/models/contacts.server.model');
require('../../../messages/server/models/message.server.model');
require('../../../messages/server/models/message-stat.server.model');
require('../../../messages/server/models/thread.server.model');
require('../../../offers/server/models/offer.server.model');
require('../../../tribes/server/models/tribe.server.model');

const profileController = require('../../server/controllers/users.profile.server.controller');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

const User = mongoose.model('User');

const controllerPath =
  '../../server/controllers/users.profile.server.controller';
const errorServicePath = '../../../core/server/services/error.server.service';

function loadControllerWithEmptyErrorMessage() {
  return proxyquire(controllerPath, {
    [errorServicePath]: {
      getErrorMessage: () => false,
      getErrorMessageByKey: require(errorServicePath).getErrorMessageByKey,
    },
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
    return mongoose.connection.readyState ? utils.clearDatabase() : undefined;
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

    it('uses the default message when removing a registration fails without details', async () => {
      const controller = loadControllerWithEmptyErrorMessage();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      sinon.stub(User, 'findByIdAndUpdate').returns({
        exec: cb => cb({}),
      });

      const res = deferredResponse();
      controller.removePushRegistration(
        { user: { _id: saved._id }, params: { token: 'token-1' } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal(
        'Failed to remove registration, please try again.',
      );
    });

    it('removes a historical registration by token', async () => {
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

    it('rejects new registrations because push is retired', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      profileController.addPushRegistration(
        {
          user: { _id: saved._id },
          body: { token: 'token-1', platform: 'web' },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal(
        'Push notifications are no longer available.',
      );

      const reloaded = await User.findById(saved._id);
      reloaded.pushRegistration.length.should.equal(0);
    });
  });
});
