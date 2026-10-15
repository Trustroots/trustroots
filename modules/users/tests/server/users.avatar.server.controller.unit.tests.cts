/**
 * Unit tests for avatar controller guards and URL generation branches.
 */
const fs: typeof import('fs') = require('fs');
const os: typeof import('os') = require('os');
const path: typeof import('path') = require('path');
const mongoose: typeof import('mongoose') = require('mongoose');
const proxyquire: typeof import('./../../../../testutils/server/mock-module.mts').default = require('./../../../../testutils/server/mock-module');

const config: typeof import('../../../../config/config.mts').default = require('./../../../../config/config.mts');
require('./../../server/models/user.server.model.mjs');

type AvatarUser = {
  _id: import('mongoose').Types.ObjectId | string;
  roles?: string[];
  blocked?: Array<import('mongoose').Types.ObjectId | string>;
  public?: boolean;
  avatarVersion?: string;
  avatarSource?: string;
  avatarUploaded?: boolean;
  updated?: Date;
  emailHash?: string;
  additionalProvidersData?: AvatarUserRecord['additionalProvidersData'];
};
type AvatarRequest = {
  user?: AvatarUser;
  profile?: AvatarUser;
  query?: Record<string, string>;
  file?: { path: string };
};
type AvatarController = {
  avatarUpload(
    req: { user: AvatarUser; file: { path: string } },
    res: MockResponse,
  ): void;
  avatarUploadField(
    req: AvatarRequest,
    res: MockResponse,
    next: () => void,
  ): void;
  getAvatar(req: AvatarRequest, res: MockResponse): void;
  userForAvatarByUserId(
    req: AvatarRequest,
    res: MockResponse,
    next: () => void,
    id: string,
  ): void;
};
const avatarController =
  require('./../../server/controllers/users.avatar.server.controller.mjs') as AvatarController;
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
require('should');

type UserRecord =
  import('../../../../testutils/server/model-contracts.mts').UserRecord;
interface AvatarUserRecord extends UserRecord {
  updated?: Date;
  emailHash?: string;
  avatarVersion?: string;
  avatarSource?: string;
  avatarUploaded?: boolean;
  additionalProvidersData?: {
    facebook?: { id?: string };
    github?: { login?: string };
    twitter?: { screen_name?: string };
  };
}
const User = mongoose.model<AvatarUserRecord>('User');
type UserLookup = ReturnType<typeof User.findById>;
function replaceAvatarVersionLookup(
  error: Error | null,
  version: string | null,
): void {
  const query = {
    exec(
      callback?: (
        error: Error | null,
        user: { avatarVersion?: string } | null,
      ) => void,
    ) {
      const user = version === null ? null : { avatarVersion: version };
      if (typeof callback === 'function') {
        callback(error, user);
        return undefined;
      }
      return error ? Promise.reject(error) : Promise.resolve(user);
    },
  };
  User.findById = (() =>
    query as unknown as UserLookup) as typeof User.findById;
}
async function findUser(id: unknown) {
  const user = await User.findById(id);
  if (!user) throw new Error('Expected test user to exist');
  return user;
}
interface AvatarProcessingResult {
  version: string;
  avatarDirectory: string;
  versionDirectory?: string;
}
interface AvatarProcessingJob {
  sourcePath: string;
  userId: import('mongoose').Types.ObjectId;
  callback(error: Error | null, result?: AvatarProcessingResult): void;
}
interface AvatarProcessor {
  enqueueAvatarProcessing(job: AvatarProcessingJob): boolean;
  removeAvatarVersion?(directory: string, version: string): Promise<void>;
}
interface AvatarLogEntry {
  level: string;
  message: string;
  detail?: unknown;
}
function requireJob(job: AvatarProcessingJob | undefined): AvatarProcessingJob {
  if (!job) throw new Error('Expected avatar processing job');
  return job;
}
type MockResponse = {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  redirectUrl: string;
  status(code: number): MockResponse;
  send(body: unknown): MockResponse;
  redirect(url: string): MockResponse;
  setHeader(key: string, value: string): MockResponse;
  waitForResponse(): Promise<MockResponse>;
};
function responseMessage(res: MockResponse): string {
  const body = res.body;
  if (
    typeof body !== 'object' ||
    body === null ||
    !('message' in body) ||
    typeof body.message !== 'string'
  )
    throw new Error('Expected a message response');
  return body.message;
}

function deferredResponse(): MockResponse {
  let resolveResponse: (response: MockResponse) => void = () => {};
  const promise = new Promise<MockResponse>(resolve => {
    resolveResponse = resolve;
  });
  const res: MockResponse = {
    statusCode: 200,
    body: null,
    headers: {},
    redirectUrl: '',
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(body) {
      res.body = body;
      resolveResponse(res);
      return res;
    },
    redirect(url) {
      res.redirectUrl = url;
      resolveResponse(res);
      return res;
    },
    setHeader(key, value) {
      res.headers[key] = value;
      return res;
    },
    waitForResponse() {
      return promise;
    },
  };
  return res;
}

describe('Avatar controller unit tests', () => {
  it('exposes the bounded upload pipeline through the ESM adapter', async () => {
    const esmController =
      await import('../../server/controllers/users.avatar.server.controller.mjs');

    esmController.avatarUpload.should.equal(avatarController.avatarUpload);
    esmController.avatarUploadField.should.equal(
      avatarController.avatarUploadField,
    );
    esmController.getAvatar.should.equal(avatarController.getAvatar);
    esmController.userForAvatarByUserId.should.equal(
      avatarController.userForAvatarByUserId,
    );
  });

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
      let uploadArgs:
        | [string[], string, object, MockResponse, () => void, number]
        | undefined;
      const controller = loadAvatarWithStubs({
        './../../../core/server/services/file-upload.service.mjs': {
          uploadFile: (
            ...args: [
              string[],
              string,
              object,
              MockResponse,
              () => void,
              number,
            ]
          ) => {
            uploadArgs = args;
          },
        },
      });
      const req: AvatarRequest = {
        user: { _id: new mongoose.Types.ObjectId() },
      };
      const res = deferredResponse();
      const next = () => {};

      controller.avatarUploadField(req, res, next);

      (uploadArgs ??
        (() => {
          throw new Error('Expected upload arguments');
        })())[0].should.containEql('image/jpeg');
      (uploadArgs ??
        (() => {
          throw new Error('Expected upload arguments');
        })())[1].should.equal('avatar');
      (uploadArgs ??
        (() => {
          throw new Error('Expected upload arguments');
        })())[2].should.equal(req);
      (uploadArgs ??
        (() => {
          throw new Error('Expected upload arguments');
        })())[3].should.equal(res);
      (uploadArgs ??
        (() => {
          throw new Error('Expected upload arguments');
        })())[4].should.equal(next);
      (uploadArgs ??
        (() => {
          throw new Error('Expected upload arguments');
        })())[5].should.equal(config.maxAvatarUploadSize);
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
      const req: {
        user: typeof viewer;
        profile?: { _id: import('mongoose').Types.ObjectId };
      } = { user: viewer };
      await new Promise<void>(resolve => {
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
      (
        req.profile ??
        (() => {
          throw new Error('Expected profile to be loaded');
        })()
      )._id
        .toString()
        .should.equal(target._id.toString());
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
      const targetDoc = await findUser(target._id);
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
      const targetDoc = await findUser(target._id);
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

    it('redirects to the default avatar for a suspended profile', async () => {
      const [viewer] = await utils.saveUsers(utils.generateUsers(1));
      const [target] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      const targetDoc = await findUser(target._id);
      targetDoc.roles = ['user', 'suspended'];
      targetDoc.avatarUploaded = true;
      targetDoc.avatarSource = 'local';
      await targetDoc.save();

      const res = deferredResponse();
      avatarController.getAvatar(
        { user: viewer, profile: targetDoc, query: { size: '128' } },
        res,
      );
      await res.waitForResponse();
      res.redirectUrl.should.containEql('/img/avatar-128.png');
    });

    it('redirects to the default avatar when the profile blocked the viewer', async () => {
      const [viewer] = await utils.saveUsers(utils.generateUsers(1));
      const [target] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      const targetDoc = await findUser(target._id);
      targetDoc.blocked = [new mongoose.Types.ObjectId(viewer._id.toString())];
      targetDoc.avatarUploaded = true;
      targetDoc.avatarSource = 'local';
      await targetDoc.save();

      const res = deferredResponse();
      avatarController.getAvatar(
        { user: viewer, profile: targetDoc, query: { size: '128' } },
        res,
      );
      await res.waitForResponse();
      res.redirectUrl.should.containEql('/img/avatar-128.png');
    });

    it('lets admins view a shadowbanned profile avatar', async () => {
      const [viewer, target] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      viewer.roles = ['user', 'admin'];
      const targetDoc = await findUser(target._id);
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
      const targetDoc = await findUser(target._id);
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
      const userDoc = await findUser(user._id);
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
      const userDoc = await findUser(user._id);
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
      const userDoc = await findUser(user._id);
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
      const userDoc = await findUser(user._id);
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
        const userDoc = await findUser(user._id);
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
      const userDoc = await findUser(user._id);
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

    it('rejects a Facebook avatar source requested by the owner', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(user._id);
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
      res.statusCode.should.equal(400);
      responseMessage(res).should.containEql('Invalid source');
    });

    it('falls back to the default avatar for an unnormalised legacy source', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(user._id);
      userDoc.avatarSource = 'facebook';
      userDoc.additionalProvidersData = { facebook: {} };
      userDoc.markModified('additionalProvidersData');
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
      res.redirectUrl.should.containEql('/img/avatar-128.png');
    });

    it('redirects to a gravatar url when requested by the owner', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(user._id);
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
      const userDoc = await findUser(user._id);
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

  function loadAvatarWithStubs(stubs: Record<string, unknown>) {
    return proxyquire<AvatarController>(
      require.resolve('./../../server/controllers/users.avatar.server.controller.mts'),
      stubs,
    );
  }

  function loadAvatarWithProcessor(processor: AvatarProcessor) {
    return loadAvatarWithStubs({
      './../../server/services/avatar-processing.server.service.mts': processor,
    });
  }

  describe('avatarUpload', () => {
    it('logs temporary upload cleanup failures after processor errors', async () => {
      const logged: AvatarLogEntry[] = [];
      let job: AvatarProcessingJob | undefined;
      const controller = loadAvatarWithStubs({
        fs: {
          promises: {
            unlink: async () => {
              throw new Error('temporary cleanup failed');
            },
          },
        },
        './../../../../config/lib/logger.mjs': (
          level: string,
          message: string,
          detail?: unknown,
        ) => {
          logged.push({ level, message, detail });
        },
        '../services/avatar-processing.server.service': {
          enqueueAvatarProcessing: (value: AvatarProcessingJob) => {
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
      requireJob(job).callback(new Error('image processor failed'));
      await res.waitForResponse();

      res.statusCode.should.equal(422);
      logged
        .map(entry => entry.message)
        .should.containEql(
          'User profile avatar upload: failed to clean out temporary image.',
        );
    });

    it('logs version cleanup failures and uses the fallback save error message', async () => {
      const logged: AvatarLogEntry[] = [];
      let job: AvatarProcessingJob | undefined;
      const sourcePath = path.join(
        os.tmpdir(),
        `avatar-save-${Date.now()}.jpg`,
      );
      fs.writeFileSync(sourcePath, 'anonymous-test-image');
      const controller = loadAvatarWithStubs({
        './../../../../config/lib/logger.mjs': (
          level: string,
          message: string,
          detail?: unknown,
        ) => {
          logged.push({ level, message, detail });
        },
        './../../../core/server/services/error.server.service.mjs': {
          getErrorMessage: () => '',
        },
        '../services/avatar-processing.server.service': {
          enqueueAvatarProcessing: (value: AvatarProcessingJob) => {
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
        save: async () => {
          throw new Error('database unavailable');
        },
      };
      const res = deferredResponse();

      controller.avatarUpload({ user, file: { path: sourcePath } }, res);
      requireJob(job).callback(null, {
        version: 'b'.repeat(32),
        avatarDirectory: '/private/avatar-dir',
      });
      await res.waitForResponse();

      res.statusCode.should.equal(400);
      responseMessage(res).should.equal(
        'Failed to save the new avatar version.',
      );
      logged
        .map(entry => entry.message)
        .should.containEql(
          'User profile avatar upload: failed to clean up unpublished avatar version.',
        );
      fs.existsSync(sourcePath).should.equal(false);
    });

    it('logs avatar pointer verification errors without failing the upload', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(user._id);
      const originalFindById = User.findById;
      const logged: AvatarLogEntry[] = [];
      const controller = loadAvatarWithStubs({
        './../../../../config/lib/logger.mjs': (
          level: string,
          message: string,
          detail?: unknown,
        ) => {
          logged.push({ level, message, detail });
        },
        '../services/avatar-processing.server.service': {
          enqueueAvatarProcessing: (job: AvatarProcessingJob) => {
            process.nextTick(() =>
              requireJob(job).callback(null, {
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
      replaceAvatarVersionLookup(new Error('avatar lookup failed'), null);

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
        .map(entry => entry.message)
        .should.containEql(
          'User profile avatar upload: failed to verify current avatar version.',
        );
    });

    it('keeps the previous version when another upload has replaced its pointer', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(user._id);
      const originalFindById = User.findById;
      let job: AvatarProcessingJob | undefined;
      const removed: string[] = [];
      const controller = loadAvatarWithProcessor({
        enqueueAvatarProcessing: (value: AvatarProcessingJob) => {
          job = value;
          return true;
        },
        removeAvatarVersion: async (_directory: string, version: string) => {
          removed.push(version);
        },
      });
      const res = deferredResponse();
      replaceAvatarVersionLookup(null, 'd'.repeat(32));

      try {
        controller.avatarUpload(
          { user: userDoc, file: { path: '/private/avatar-upload.jpg' } },
          res,
        );
        requireJob(job).callback(null, {
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
      const userDoc = await findUser(user._id);
      userDoc.avatarVersion = 'f'.repeat(32);
      await userDoc.save();
      const originalFindById = User.findById;
      const logged: AvatarLogEntry[] = [];
      const controller = loadAvatarWithStubs({
        './../../../../config/lib/logger.mjs': (
          level: string,
          message: string,
          detail?: unknown,
        ) => {
          logged.push({ level, message, detail });
        },
        '../services/avatar-processing.server.service': {
          enqueueAvatarProcessing: (job: AvatarProcessingJob) => {
            process.nextTick(() =>
              requireJob(job).callback(null, {
                version: '1'.repeat(32),
                avatarDirectory: '/private/avatar-dir',
              }),
            );
            return true;
          },
          removeAvatarVersion: async (_directory: string, version: string) => {
            if (version === 'f'.repeat(32)) {
              throw new Error('old version cleanup failed');
            }
          },
        },
      });
      const res = deferredResponse();
      replaceAvatarVersionLookup(null, '1'.repeat(32));

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
        .map(entry => entry.message)
        .should.containEql(
          'User profile avatar upload: failed to remove the previous avatar version.',
        );
    });

    it('publishes a complete avatar version and removes the old version', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(user._id);
      userDoc.avatarVersion = 'a'.repeat(32);
      await userDoc.save();
      const sourcePath = path.join(os.tmpdir(), `avatar-${Date.now()}.jpg`);
      fs.writeFileSync(sourcePath, 'anonymous-test-image');
      let job: AvatarProcessingJob | undefined;
      const removed: string[] = [];
      const nextVersion = 'b'.repeat(32);
      const controller = loadAvatarWithProcessor({
        enqueueAvatarProcessing: (value: AvatarProcessingJob) => {
          job = value;
          return true;
        },
        removeAvatarVersion: async (directory: string, version: string) => {
          removed.push(version);
        },
      });
      const res = deferredResponse();

      controller.avatarUpload(
        { user: userDoc, file: { path: sourcePath } },
        res,
      );
      requireJob(job).callback(null, {
        version: nextVersion,
        avatarDirectory: '/private/avatar-dir',
        versionDirectory: '/private/avatar-dir/version',
      });
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      (await findUser(user._id)).avatarVersion!.should.equal(nextVersion);
      removed.should.eql(['a'.repeat(32)]);
      fs.existsSync(sourcePath).should.equal(false);
    });

    it('preserves the current avatar when processing fails', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(user._id);
      userDoc.avatarVersion = 'c'.repeat(32);
      await userDoc.save();
      const sourcePath = path.join(
        os.tmpdir(),
        `avatar-failed-${Date.now()}.jpg`,
      );
      fs.writeFileSync(sourcePath, 'anonymous-test-image');
      let job: AvatarProcessingJob | undefined;
      const controller = loadAvatarWithProcessor({
        enqueueAvatarProcessing: (value: AvatarProcessingJob) => {
          job = value;
          return true;
        },
      });
      const res = deferredResponse();

      controller.avatarUpload(
        { user: userDoc, file: { path: sourcePath } },
        res,
      );
      requireJob(job).callback(new Error('processor rejected image'));
      await res.waitForResponse();

      res.statusCode.should.equal(422);
      (await findUser(user._id)).avatarVersion!.should.equal('c'.repeat(32));
      fs.existsSync(sourcePath).should.equal(false);
    });

    it('removes the new version and restores the old pointer when saving fails', async () => {
      const oldVersion = 'd'.repeat(32);
      const newVersion = 'e'.repeat(32);
      let job: AvatarProcessingJob | undefined;
      const removed: string[] = [];
      const controller = loadAvatarWithProcessor({
        enqueueAvatarProcessing: (value: AvatarProcessingJob) => {
          job = value;
          return true;
        },
        removeAvatarVersion: async (directory: string, version: string) => {
          removed.push(version);
        },
      });
      const sourcePath = path.join(
        os.tmpdir(),
        `avatar-save-failed-${Date.now()}.jpg`,
      );
      fs.writeFileSync(sourcePath, 'anonymous-test-image');
      const user = {
        _id: new mongoose.Types.ObjectId(),
        avatarVersion: oldVersion,
        save: (callback: (error: Error) => void) =>
          callback(new Error('database unavailable')),
      };
      const res = deferredResponse();

      controller.avatarUpload({ user, file: { path: sourcePath } }, res);
      requireJob(job).callback(null, {
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
