/**
 * Unit tests for avatar controller guards and URL generation branches.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');

const avatarController = require('../../server/controllers/users.avatar.server.controller');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

const User = mongoose.model('User');

function deferredResponse() {
  let resolveResponse;
  const promise = new Promise(resolve => {
    resolveResponse = resolve;
  });
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
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
  res.redirect = url => {
    res.redirectUrl = url;
    resolveResponse(res);
    return res;
  };
  res.setHeader = (key, value) => {
    res.headers[key] = value;
    return res;
  };
  res.waitForResponse = () => promise;
  return res;
}

describe('Avatar controller unit tests', () => {
  afterEach(utils.clearDatabase);

  describe('avatarUploadField', () => {
    it('responds with 403 without a user', async () => {
      const res = deferredResponse();
      avatarController.avatarUploadField({}, res, () => {});
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });
  });

  describe('userForAvatarByUserId', () => {
    it('responds with 403 without a user', async () => {
      const res = deferredResponse();
      avatarController.userForAvatarByUserId(
        {},
        res,
        () => {},
        new mongoose.Types.ObjectId().toString(),
      );
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('responds with 400 for an invalid id', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      avatarController.userForAvatarByUserId({ user }, res, () => {}, 'bad-id');
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('loads the profile and calls next', async () => {
      const [viewer, target] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const res = deferredResponse();
      let nextCalled = false;
      const req = { user: viewer };
      await new Promise(resolve => {
        avatarController.userForAvatarByUserId(
          req,
          res,
          () => {
            nextCalled = true;
            resolve();
          },
          target._id.toString(),
        );
      });
      nextCalled.should.be.true();
      req.profile._id.toString().should.equal(target._id.toString());
    });
  });

  describe('getAvatar', () => {
    it('rejects an invalid avatar size', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      avatarController.getAvatar(
        { user, profile: user, query: { size: '9999' } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('redirects to the default avatar without a profile', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      avatarController.getAvatar({ user, query: {} }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(302);
      res.redirectUrl.should.containEql('/img/avatar-');
    });

    it('redirects to the default avatar for a hidden profile', async () => {
      const [viewer] = await utils.saveUsers(utils.generateUsers(1));
      const [target] = await utils.saveUsers(
        utils.generateUsers(1, { public: false }),
      );
      const targetDoc = await User.findById(target._id);
      const res = deferredResponse();
      avatarController.getAvatar(
        { user: viewer, profile: targetDoc, query: {} },
        res,
      );
      await res.waitForResponse();
      res.redirectUrl.should.containEql('/img/avatar-');
    });

    it('rejects an invalid avatar source for the owner', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(user._id);
      const res = deferredResponse();
      avatarController.getAvatar(
        {
          user: userDoc,
          profile: userDoc,
          query: { source: 'not-a-source' },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('redirects to a gravatar url when requested by the owner', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(user._id);
      userDoc.emailHash = 'abc123';
      await userDoc.save();
      const res = deferredResponse();
      avatarController.getAvatar(
        {
          user: userDoc,
          profile: userDoc,
          query: { source: 'gravatar', size: '128' },
        },
        res,
      );
      await res.waitForResponse();
      res.redirectUrl.should.containEql('gravatar.com');
    });
  });

  describe('avatarUpload', () => {
    it('uploads an avatar using the processor fallback', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(user._id);
      const tmpFile = path.join(os.tmpdir(), `avatar-${Date.now()}.jpg`);
      fs.writeFileSync(tmpFile, 'fake-image');

      const res = deferredResponse();
      avatarController.avatarUpload(
        {
          user: userDoc,
          file: { path: tmpFile },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.message.should.equal('Avatar image uploaded.');
    });
  });
});
