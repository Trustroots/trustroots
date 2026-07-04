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
    it('loads the ImageMagick processor when configured', () => {
      const config = require('../../../../config/config');
      let subClassOptions;

      const controller = loadAvatarWithStubs({
        '../../../../config/config': {
          ...config,
          imageProcessor: 'imagemagic',
        },
        gm: Object.assign(() => ({}), {
          subClass: options => {
            subClassOptions = options;
            return () => ({});
          },
        }),
      });

      controller.should.have.property('getAvatar');
      subClassOptions.should.deepEqual({ imageMagick: true });
    });

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

  function loadAvatarWithGm(writeHandler) {
    function chainable() {
      const chain = {
        autoOrient: () => chain,
        noProfile: () => chain,
        colorspace: () => chain,
        interlace: () => chain,
        filter: () => chain,
        resize: () => chain,
        gravity: () => chain,
        extent: () => chain,
        unsharp: () => chain,
        quality: () => chain,
        write: (outputPath, cb) => writeHandler(cb),
      };
      return chain;
    }

    return proxyquire(
      '../../server/controllers/users.avatar.server.controller',
      {
        gm: () => chainable(),
      },
    );
  }

  function loadAvatarWithStubs(stubs) {
    return proxyquire(
      '../../server/controllers/users.avatar.server.controller',
      stubs,
    );
  }

  describe('avatarUpload', () => {
    it('uploads an avatar using the image processor', async () => {
      const previousFallback = process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;
      delete process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;

      try {
        const controller = loadAvatarWithGm(cb => cb());
        const [user] = await utils.saveUsers(utils.generateUsers(1));
        const userDoc = await User.findById(user._id);
        const tmpFile = path.join(os.tmpdir(), `avatar-gm-${Date.now()}.jpg`);
        fs.writeFileSync(tmpFile, 'fake-image');

        const res = deferredResponse();
        controller.avatarUpload(
          {
            user: userDoc,
            file: { path: tmpFile },
          },
          res,
        );
        await res.waitForResponse();
        res.statusCode.should.equal(200);
        res.body.message.should.equal('Avatar image uploaded.');
      } finally {
        if (previousFallback === undefined) {
          delete process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;
        } else {
          process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK = previousFallback;
        }
      }
    });

    it('returns 400 when the upload directory cannot be created', async () => {
      const previousFallback = process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;
      delete process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;

      try {
        const controller = loadAvatarWithStubs({
          'mkdir-recursive': {
            mkdir: (directory, cb) => cb(new Error('mkdir failed')),
          },
        });
        const [user] = await utils.saveUsers(utils.generateUsers(1));
        const userDoc = await User.findById(user._id);
        const res = deferredResponse();

        controller.avatarUpload(
          {
            user: userDoc,
            file: { path: '/tmp/missing-avatar-source.jpg' },
          },
          res,
        );
        await res.waitForResponse();
        res.statusCode.should.equal(400);
      } finally {
        if (previousFallback === undefined) {
          delete process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;
        } else {
          process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK = previousFallback;
        }
      }
    });

    it('continues when the upload directory already exists', async () => {
      const previousFallback = process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;
      process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK = 'true';

      try {
        const controller = loadAvatarWithStubs({
          'mkdir-recursive': {
            mkdir: (directory, cb) =>
              cb(Object.assign(new Error('exists'), { code: 'EEXIST' })),
          },
          fs: {
            copyFile: (source, destination, cb) => cb(),
            unlink: (source, cb) => cb(),
          },
        });
        const [user] = await utils.saveUsers(utils.generateUsers(1));
        const userDoc = await User.findById(user._id);
        const res = deferredResponse();

        controller.avatarUpload(
          {
            user: userDoc,
            file: { path: '/tmp/avatar-existing-dir.jpg' },
          },
          res,
        );
        await res.waitForResponse();
        res.statusCode.should.equal(200);
        res.body.message.should.equal('Avatar image uploaded.');
      } finally {
        if (previousFallback === undefined) {
          delete process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;
        } else {
          process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK = previousFallback;
        }
      }
    });

    it('returns 400 when fallback upload cleanup fails', async () => {
      const previousFallback = process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;
      process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK = 'true';

      try {
        const controller = loadAvatarWithStubs({
          fs: {
            copyFile: (source, destination, cb) => cb(),
            unlink: (source, cb) => cb(new Error('unlink failed')),
          },
        });
        const [user] = await utils.saveUsers(utils.generateUsers(1));
        const userDoc = await User.findById(user._id);
        const res = deferredResponse();

        controller.avatarUpload(
          {
            user: userDoc,
            file: { path: '/tmp/avatar-cleanup-fails.jpg' },
          },
          res,
        );
        await res.waitForResponse();
        res.statusCode.should.equal(400);
      } finally {
        if (previousFallback === undefined) {
          delete process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;
        } else {
          process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK = previousFallback;
        }
      }
    });

    it('logs cleanup failures after thumbnail processing errors', async () => {
      const previousFallback = process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;
      delete process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;

      try {
        const chainable = () => {
          const chain = {
            autoOrient: () => chain,
            noProfile: () => chain,
            colorspace: () => chain,
            interlace: () => chain,
            filter: () => chain,
            resize: () => chain,
            gravity: () => chain,
            extent: () => chain,
            unsharp: () => chain,
            quality: () => chain,
            write: (outputPath, cb) =>
              setImmediate(() => cb(new Error('gm processing failed'))),
          };
          return chain;
        };

        const controller = loadAvatarWithStubs({
          gm: () => chainable(),
          fs: {
            unlink: (source, cb) =>
              setImmediate(() => cb(new Error('cleanup failed'))),
          },
        });
        const [user] = await utils.saveUsers(utils.generateUsers(1));
        const userDoc = await User.findById(user._id);
        const res = deferredResponse();

        controller.avatarUpload(
          {
            user: userDoc,
            file: { path: '/tmp/avatar-cleanup-log-fails.jpg' },
          },
          res,
        );
        await res.waitForResponse();
        res.statusCode.should.equal(422);
      } finally {
        if (previousFallback === undefined) {
          delete process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;
        } else {
          process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK = previousFallback;
        }
      }
    });

    it('returns 422 when thumbnail generation fails', async () => {
      const previousFallback = process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;
      delete process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;

      try {
        const controller = loadAvatarWithGm(cb =>
          cb(new Error('gm processing failed')),
        );
        const [user] = await utils.saveUsers(utils.generateUsers(1));
        const userDoc = await User.findById(user._id);
        const tmpFile = path.join(
          os.tmpdir(),
          `avatar-gm-fail-${Date.now()}.jpg`,
        );
        fs.writeFileSync(tmpFile, 'fake-image');

        const res = deferredResponse();
        controller.avatarUpload(
          {
            user: userDoc,
            file: { path: tmpFile },
          },
          res,
        );
        await res.waitForResponse();
        res.statusCode.should.equal(422);
      } finally {
        if (previousFallback === undefined) {
          delete process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;
        } else {
          process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK = previousFallback;
        }
      }
    });

    it('uploads an avatar using the processor fallback', async () => {
      const previousFallback = process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;
      process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK = 'true';

      try {
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
      } finally {
        if (previousFallback === undefined) {
          delete process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;
        } else {
          process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK = previousFallback;
        }
      }
    });
  });
});
