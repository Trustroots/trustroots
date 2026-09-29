/**
 * Unit tests for avatar controller guards and URL generation branches.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const proxyquire = require('proxyquire').noCallThru();

const config = require('../../../../config/config');
require('../../server/models/user.server.model');

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
  afterEach(() => {
    return mongoose.connection.readyState ? utils.clearDatabase() : undefined;
  });

  describe('avatarUploadField', () => {
    it('responds with 403 without a user', async () => {
      const res = deferredResponse();
      avatarController.avatarUploadField({}, res, () => {});
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('delegates authenticated uploads to the file upload service', () => {
      let uploadArgs;
      const controller = loadAvatarWithStubs({
        '../../../core/server/services/file-upload.service': {
          uploadFile: (...args) => {
            uploadArgs = args;
          },
        },
      });
      const req = { user: { _id: new mongoose.Types.ObjectId() } };
      const res = deferredResponse();
      const next = () => {};

      controller.avatarUploadField(req, res, next);

      uploadArgs[0].should.containEql('image/jpeg');
      uploadArgs[1].should.equal('avatar');
      uploadArgs[2].should.equal(req);
      uploadArgs[3].should.equal(res);
      uploadArgs[4].should.equal(next);
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

    it('redirects to the default avatar for a shadowbanned profile', async () => {
      const [viewer] = await utils.saveUsers(utils.generateUsers(1));
      const [target] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      const targetDoc = await User.findById(target._id);
      targetDoc.roles = ['user', 'shadowban'];
      await targetDoc.save();

      const res = deferredResponse();
      avatarController.getAvatar(
        { user: viewer, profile: targetDoc, query: {} },
        res,
      );
      await res.waitForResponse();
      res.redirectUrl.should.containEql('/img/avatar-');
    });

    it('lets admins view a shadowbanned profile avatar', async () => {
      const [viewer, target] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      viewer.roles = ['user', 'admin'];
      const targetDoc = await User.findById(target._id);
      targetDoc.roles = ['user', 'shadowban'];
      targetDoc.avatarUploaded = true;
      targetDoc.avatarSource = 'local';
      await targetDoc.save();

      const res = deferredResponse();
      avatarController.getAvatar(
        { user: viewer, profile: targetDoc, query: { size: '128' } },
        res,
      );
      await res.waitForResponse();
      res.redirectUrl.should.containEql('/uploads-profile/');
    });

    it('ignores custom avatar source requests from non-owners', async () => {
      const [viewer, target] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const targetDoc = await User.findById(target._id);
      targetDoc.avatarUploaded = true;
      targetDoc.avatarSource = 'local';
      await targetDoc.save();

      const res = deferredResponse();
      avatarController.getAvatar(
        {
          user: viewer,
          profile: targetDoc,
          query: { source: 'not-a-source', size: '128' },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(302);
      res.redirectUrl.should.containEql('/uploads-profile/');
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

    it('redirects to a local avatar url when the user uploaded one', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(user._id);
      userDoc.avatarUploaded = true;
      userDoc.avatarSource = 'local';
      await userDoc.save();

      const res = deferredResponse();
      avatarController.getAvatar(
        {
          user: userDoc,
          profile: userDoc,
          query: { size: '128' },
        },
        res,
      );
      await res.waitForResponse();
      res.redirectUrl.should.containEql('/uploads-profile/');
    });

    it('includes an update timestamp in local avatar URLs', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(user._id);
      userDoc.avatarUploaded = true;
      userDoc.avatarSource = 'local';
      userDoc.updated = new Date('2026-01-02T03:04:05.000Z');
      await userDoc.save();

      const res = deferredResponse();
      avatarController.getAvatar(
        {
          user: userDoc,
          profile: userDoc,
          query: { source: 'local', size: '128' },
        },
        res,
      );
      await res.waitForResponse();

      res.redirectUrl.should.containEql('/uploads-profile/');
      res.redirectUrl.should.endWith(`?${userDoc.updated.getTime()}`);
    });

    it('includes the server-owned avatar version in local avatar URLs', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(user._id);
      const version = 'f'.repeat(32);
      userDoc.avatarUploaded = true;
      userDoc.avatarSource = 'local';
      userDoc.avatarVersion = version;
      await userDoc.save();

      const res = deferredResponse();
      avatarController.getAvatar(
        {
          user: userDoc,
          profile: userDoc,
          query: { source: 'local', size: '128' },
        },
        res,
      );
      await res.waitForResponse();

      res.redirectUrl.should.containEql(`/avatar/${version}/128.jpg`);
    });

    it('uses the https domain for local avatar URLs when configured', async () => {
      const originalHttps = config.https;
      config.https = true;

      try {
        const [user] = await utils.saveUsers(utils.generateUsers(1));
        const userDoc = await User.findById(user._id);
        userDoc.avatarUploaded = true;
        userDoc.avatarSource = 'local';
        await userDoc.save();

        const res = deferredResponse();
        avatarController.getAvatar(
          {
            user: userDoc,
            profile: userDoc,
            query: { source: 'local', size: '128' },
          },
          res,
        );
        await res.waitForResponse();

        res.redirectUrl.should.startWith('https://');
        res.redirectUrl.should.containEql('/uploads-profile/');
      } finally {
        config.https = originalHttps;
      }
    });

    it('redirects to a local avatar url without a timestamp when updated is absent', async () => {
      const userId = new mongoose.Types.ObjectId();
      const res = deferredResponse();

      avatarController.getAvatar(
        {
          user: { _id: userId, roles: [] },
          profile: {
            _id: userId,
            avatarUploaded: true,
            avatarSource: 'local',
            public: true,
            roles: [],
          },
          query: { source: 'local', size: '128' },
        },
        res,
      );
      await res.waitForResponse();

      res.redirectUrl.should.containEql('/uploads-profile/');
      res.redirectUrl.endsWith('?').should.be.true();
    });

    it('uses the https domain for default avatar redirects when configured', async () => {
      const originalHttps = config.https;
      config.https = true;

      try {
        const [user] = await utils.saveUsers(utils.generateUsers(1));
        const res = deferredResponse();
        avatarController.getAvatar({ user, query: { size: '128' } }, res);
        await res.waitForResponse();

        res.redirectUrl.should.startWith('https://');
        res.redirectUrl.should.containEql('/img/avatar-128.png');
      } finally {
        config.https = originalHttps;
      }
    });

    it('falls back to the default avatar when local source has no upload', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(user._id);
      userDoc.avatarUploaded = false;
      userDoc.avatarSource = 'local';
      await userDoc.save();

      const res = deferredResponse();
      avatarController.getAvatar(
        {
          user: userDoc,
          profile: userDoc,
          query: { source: 'local', size: '128' },
        },
        res,
      );
      await res.waitForResponse();
      res.redirectUrl.should.containEql('/img/avatar-128.png');
    });

    it('redirects to a facebook avatar url when requested by the owner', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(user._id);
      userDoc.additionalProvidersData = { facebook: { id: 'fb-123' } };
      userDoc.markModified('additionalProvidersData');
      await userDoc.save();

      const res = deferredResponse();
      avatarController.getAvatar(
        {
          user: userDoc,
          profile: userDoc,
          query: { source: 'facebook', size: '128' },
        },
        res,
      );
      await res.waitForResponse();
      res.redirectUrl.should.containEql('graph.facebook.com');
    });

    it('falls back to default avatar when facebook source has no id', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(user._id);
      userDoc.avatarSource = 'facebook';
      userDoc.additionalProvidersData = { facebook: {} };
      userDoc.markModified('additionalProvidersData');
      await userDoc.save();

      const res = deferredResponse();
      avatarController.getAvatar(
        {
          user: userDoc,
          profile: userDoc,
          query: { source: 'facebook', size: '128' },
        },
        res,
      );
      await res.waitForResponse();
      res.redirectUrl.should.containEql('/img/avatar-128.png');
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

    it('uses the default avatar as the Gravatar fallback image', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(user._id);
      userDoc.avatarSource = 'gravatar';
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
      res.redirectUrl.should.containEql('gravatar.com/avatar/');
      decodeURIComponent(res.redirectUrl).should.containEql(
        'd=https://trustroots.org/img/avatar-128.png',
      );
    });
  });

  function loadAvatarWithStubs(stubs) {
    return proxyquire(
      '../../server/controllers/users.avatar.server.controller',
      stubs,
    );
  }

  function loadAvatarWithProcessor(processor) {
    return loadAvatarWithStubs({
      '../../server/services/avatar-processing.server.service': processor,
    });
  }

  describe('avatarUpload', () => {
    it('logs temporary upload cleanup failures after processor errors', async () => {
      const logged = [];
      let job;
      const controller = loadAvatarWithStubs({
        fs: {
          promises: {
            unlink: async () => {
              throw new Error('temporary cleanup failed');
            },
          },
        },
        '../../../../config/lib/logger': (...args) => logged.push(args),
        '../services/avatar-processing.server.service': {
          enqueueAvatarProcessing: value => {
            job = value;
            return true;
          },
        },
      });
      const res = deferredResponse();

      controller.avatarUpload(
        {
          user: { _id: new mongoose.Types.ObjectId() },
          file: { path: '/private/avatar-upload.jpg' },
        },
        res,
      );
      job.callback(new Error('image processor failed'));
      await res.waitForResponse();

      res.statusCode.should.equal(422);
      logged
        .map(args => args[1])
        .should.containEql(
          'User profile avatar upload: failed to clean out temporary image.',
        );
    });

    it('logs version cleanup failures and uses the fallback save error message', async () => {
      const logged = [];
      let job;
      const sourcePath = path.join(
        os.tmpdir(),
        `avatar-save-${Date.now()}.jpg`,
      );
      fs.writeFileSync(sourcePath, 'anonymous-test-image');
      const controller = loadAvatarWithStubs({
        '../../../../config/lib/logger': (...args) => logged.push(args),
        '../../../core/server/services/error.server.service': {
          getErrorMessage: () => '',
        },
        '../services/avatar-processing.server.service': {
          enqueueAvatarProcessing: value => {
            job = value;
            return true;
          },
          removeAvatarVersion: async () => {
            throw new Error('version cleanup failed');
          },
        },
      });
      const user = {
        _id: new mongoose.Types.ObjectId(),
        avatarVersion: 'a'.repeat(32),
        save: callback => callback(new Error('database unavailable')),
      };
      const res = deferredResponse();

      controller.avatarUpload({ user, file: { path: sourcePath } }, res);
      job.callback(null, {
        version: 'b'.repeat(32),
        avatarDirectory: '/private/avatar-dir',
      });
      await res.waitForResponse();

      res.statusCode.should.equal(400);
      res.body.message.should.equal('Failed to save the new avatar version.');
      logged
        .map(args => args[1])
        .should.containEql(
          'User profile avatar upload: failed to clean up unpublished avatar version.',
        );
      fs.existsSync(sourcePath).should.equal(false);
    });

    it('logs avatar pointer verification errors without failing the upload', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(user._id);
      const originalFindById = User.findById;
      const logged = [];
      const controller = loadAvatarWithStubs({
        '../../../../config/lib/logger': (...args) => logged.push(args),
        '../services/avatar-processing.server.service': {
          enqueueAvatarProcessing: job => {
            process.nextTick(() =>
              job.callback(null, {
                version: 'c'.repeat(32),
                avatarDirectory: '/private/avatar-dir',
              }),
            );
            return true;
          },
          removeAvatarVersion: async () => {},
        },
      });
      const res = deferredResponse();
      User.findById = () => ({
        exec: callback => callback(new Error('avatar lookup failed')),
      });

      try {
        controller.avatarUpload(
          { user: userDoc, file: { path: '/private/avatar-upload.jpg' } },
          res,
        );
        await res.waitForResponse();
      } finally {
        User.findById = originalFindById;
      }

      res.statusCode.should.equal(200);
      logged
        .map(args => args[1])
        .should.containEql(
          'User profile avatar upload: failed to verify current avatar version.',
        );
    });

    it('keeps the previous version when another upload has replaced its pointer', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(user._id);
      const originalFindById = User.findById;
      let job;
      const removed = [];
      const controller = loadAvatarWithProcessor({
        enqueueAvatarProcessing: value => {
          job = value;
          return true;
        },
        removeAvatarVersion: async (_directory, version) =>
          removed.push(version),
      });
      const res = deferredResponse();
      User.findById = () => ({
        exec: callback => callback(null, { avatarVersion: 'd'.repeat(32) }),
      });

      try {
        controller.avatarUpload(
          { user: userDoc, file: { path: '/private/avatar-upload.jpg' } },
          res,
        );
        job.callback(null, {
          version: 'e'.repeat(32),
          avatarDirectory: '/private/avatar-dir',
        });
        await res.waitForResponse();
      } finally {
        User.findById = originalFindById;
      }

      res.statusCode.should.equal(200);
      removed.should.be.empty();
    });

    it('reports old version cleanup errors after successfully publishing', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(user._id);
      userDoc.avatarVersion = 'f'.repeat(32);
      await userDoc.save();
      const originalFindById = User.findById;
      const logged = [];
      const controller = loadAvatarWithStubs({
        '../../../../config/lib/logger': (...args) => logged.push(args),
        '../services/avatar-processing.server.service': {
          enqueueAvatarProcessing: job => {
            process.nextTick(() =>
              job.callback(null, {
                version: '1'.repeat(32),
                avatarDirectory: '/private/avatar-dir',
              }),
            );
            return true;
          },
          removeAvatarVersion: async (_directory, version) => {
            if (version === 'f'.repeat(32)) {
              throw new Error('old version cleanup failed');
            }
          },
        },
      });
      const res = deferredResponse();
      User.findById = () => ({
        exec: callback => callback(null, { avatarVersion: '1'.repeat(32) }),
      });

      try {
        controller.avatarUpload(
          { user: userDoc, file: { path: '/private/avatar-upload.jpg' } },
          res,
        );
        await res.waitForResponse();
      } finally {
        User.findById = originalFindById;
      }

      res.statusCode.should.equal(200);
      logged
        .map(args => args[1])
        .should.containEql(
          'User profile avatar upload: failed to remove the previous avatar version.',
        );
    });

    it('publishes a complete avatar version and removes the old version', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(user._id);
      userDoc.avatarVersion = 'a'.repeat(32);
      await userDoc.save();
      const sourcePath = path.join(os.tmpdir(), `avatar-${Date.now()}.jpg`);
      fs.writeFileSync(sourcePath, 'anonymous-test-image');
      let job;
      const removed = [];
      const nextVersion = 'b'.repeat(32);
      const controller = loadAvatarWithProcessor({
        enqueueAvatarProcessing: value => {
          job = value;
          return true;
        },
        removeAvatarVersion: async (directory, version) =>
          removed.push(version),
      });
      const res = deferredResponse();

      controller.avatarUpload(
        { user: userDoc, file: { path: sourcePath } },
        res,
      );
      job.callback(null, {
        version: nextVersion,
        avatarDirectory: '/private/avatar-dir',
        versionDirectory: '/private/avatar-dir/version',
      });
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      (await User.findById(user._id)).avatarVersion.should.equal(nextVersion);
      removed.should.eql(['a'.repeat(32)]);
      fs.existsSync(sourcePath).should.equal(false);
    });

    it('preserves the current avatar when processing fails', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(user._id);
      userDoc.avatarVersion = 'c'.repeat(32);
      await userDoc.save();
      const sourcePath = path.join(
        os.tmpdir(),
        `avatar-failed-${Date.now()}.jpg`,
      );
      fs.writeFileSync(sourcePath, 'anonymous-test-image');
      let job;
      const controller = loadAvatarWithProcessor({
        enqueueAvatarProcessing: value => {
          job = value;
          return true;
        },
      });
      const res = deferredResponse();

      controller.avatarUpload(
        { user: userDoc, file: { path: sourcePath } },
        res,
      );
      job.callback(new Error('processor rejected image'));
      await res.waitForResponse();

      res.statusCode.should.equal(422);
      (await User.findById(user._id)).avatarVersion.should.equal(
        'c'.repeat(32),
      );
      fs.existsSync(sourcePath).should.equal(false);
    });

    it('removes the new version and restores the old pointer when saving fails', async () => {
      const oldVersion = 'd'.repeat(32);
      const newVersion = 'e'.repeat(32);
      let job;
      const removed = [];
      const controller = loadAvatarWithProcessor({
        enqueueAvatarProcessing: value => {
          job = value;
          return true;
        },
        removeAvatarVersion: async (directory, version) =>
          removed.push(version),
      });
      const sourcePath = path.join(
        os.tmpdir(),
        `avatar-save-failed-${Date.now()}.jpg`,
      );
      fs.writeFileSync(sourcePath, 'anonymous-test-image');
      const user = {
        _id: new mongoose.Types.ObjectId(),
        avatarVersion: oldVersion,
        save: callback => callback(new Error('database unavailable')),
      };
      const res = deferredResponse();

      controller.avatarUpload({ user, file: { path: sourcePath } }, res);
      job.callback(null, {
        version: newVersion,
        avatarDirectory: '/private/avatar-dir',
        versionDirectory: '/private/avatar-dir/version',
      });
      await res.waitForResponse();

      res.statusCode.should.equal(400);
      user.avatarVersion.should.equal(oldVersion);
      removed.should.eql([newVersion]);
      fs.existsSync(sourcePath).should.equal(false);
    });

    it('returns 503 and cleans up the temporary upload when the queue is full', async () => {
      const sourcePath = path.join(
        os.tmpdir(),
        `avatar-queued-${Date.now()}.jpg`,
      );
      fs.writeFileSync(sourcePath, 'anonymous-test-image');
      const controller = loadAvatarWithProcessor({
        enqueueAvatarProcessing: () => false,
      });
      const res = deferredResponse();

      controller.avatarUpload(
        {
          user: { _id: new mongoose.Types.ObjectId() },
          file: { path: sourcePath },
        },
        res,
      );
      await res.waitForResponse();

      res.statusCode.should.equal(503);
      fs.existsSync(sourcePath).should.equal(false);
    });
  });
});
