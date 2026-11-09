/**
 * Unit tests for avatar controller guards and URL generation branches.
 *
 * Most tests load the controller fresh through `mock-module` inside the test,
 * so its module-level version pattern is evaluated (and mutated) per test.
 */
const fs: typeof import('fs') = require('fs');
const os: typeof import('os') = require('os');
const path: typeof import('path') = require('path');
const mongoose: typeof import('mongoose') = require('mongoose');
const proxyquire: typeof import('./../../../../testutils/server/mock-module.mts').default = require('./../../../../testutils/server/mock-module');

const config: typeof import('../../../../config/config.mts').default = require('./../../../../config/config.mts');
const temporaryUploadDirectories: string[] = [];

function createTemporaryUpload(): { directory: string; path: string } {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'trustroots-avatar-'),
  );
  temporaryUploadDirectories.push(directory);
  const sourcePath = path.join(directory, 'upload.jpg');
  fs.writeFileSync(sourcePath, 'anonymous-test-image');
  return { directory, path: sourcePath };
}
require('./../../server/models/user.server.model.mjs');

type ObjectId = import('mongoose').Types.ObjectId;
type AvatarUser = {
  _id: ObjectId | string;
  roles?: string[];
  blocked?: Array<ObjectId | string>;
  public?: boolean;
  avatarVersion?: string;
  avatarSource?: string;
  avatarUploaded?: boolean;
  updated?: Date;
  emailHash?: string;
};
type AvatarRequest = {
  user?: AvatarUser;
  profile?: AvatarUser;
  query?: Record<string, string>;
  file?: { path: string };
};
type UploadUser = AvatarUser & { save(): Promise<unknown> };
type AvatarController = {
  avatarUpload(
    req: { user: UploadUser; file: { path: string } },
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
  ): Promise<void>;
};
const avatarController =
  require('./../../server/controllers/users.avatar.server.controller.mjs') as AvatarController;
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
require('should');

interface AvatarUserRecord extends AvatarUser {
  username?: string;
}
const User = mongoose.model<AvatarUserRecord>('User');
type UserLookup = ReturnType<typeof User.findById>;
function replaceAvatarVersionLookup(
  error: Error | null,
  version: string | null,
  lookups: unknown[][],
): void {
  User.findById = ((...args: unknown[]) => {
    lookups.push(args);
    return {
      exec: () =>
        error
          ? Promise.reject(error)
          : Promise.resolve(
              version === null ? null : { avatarVersion: version },
            ),
    } as unknown as UserLookup;
  }) as typeof User.findById;
}
interface AvatarProcessingResult {
  version: string;
  avatarDirectory: string;
  versionDirectory?: string;
}
interface AvatarProcessingJob {
  sourcePath: string;
  userId: ObjectId;
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
type MockResponse = {
  statusCode: number;
  body: unknown;
  redirectUrl: string;
  status(code: number): MockResponse;
  send(body: unknown): MockResponse;
  redirect(url: string): MockResponse;
  waitForResponse(): Promise<MockResponse>;
};

function deferredResponse(): MockResponse {
  let resolveResponse: (response: MockResponse) => void = () => {};
  const promise = new Promise<MockResponse>(resolve => {
    resolveResponse = resolve;
  });
  const res: MockResponse = {
    statusCode: 200,
    body: null,
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
    waitForResponse() {
      return promise;
    },
  };
  return res;
}

function loadAvatarWithStubs(stubs: Record<string, unknown> = {}) {
  return proxyquire<AvatarController>(
    require.resolve('./../../server/controllers/users.avatar.server.controller.mts'),
    stubs,
  );
}

const loggerPath = './../../../../config/lib/logger.mjs';
const forbidden = { message: 'Forbidden.' };

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
    temporaryUploadDirectories
      .splice(0)
      .forEach(directory =>
        fs.rmSync(directory, { recursive: true, force: true }),
      );
    return mongoose.connection.readyState ? utils.clearDatabase() : undefined;
  });

  describe('avatarUploadField', () => {
    it('responds with 403 without a user', () => {
      const res = deferredResponse();
      avatarController.avatarUploadField({}, res, () => {});
      [res.statusCode, res.body].should.eql([403, forbidden]);
    });

    it('delegates authenticated uploads to the file upload service', () => {
      let uploadArgs: unknown[] = [];
      const controller = loadAvatarWithStubs({
        './../../../core/server/services/file-upload.service.mjs': {
          uploadFile: (...args: unknown[]) => {
            uploadArgs = args;
          },
        },
      });
      const req = { user: { _id: new mongoose.Types.ObjectId() } };
      const res = deferredResponse();
      const next = () => {};

      controller.avatarUploadField(req, res, next);

      uploadArgs.should.eql([
        ['image/gif', 'image/jpeg', 'image/jpg', 'image/png'],
        'avatar',
        req,
        res,
        next,
        config.maxAvatarUploadSize,
      ]);
      uploadArgs[4]!.should.equal(next);
    });
  });

  describe('userForAvatarByUserId', () => {
    it('rejects requests without a user or with an invalid id', async () => {
      const cases: Array<[AvatarRequest, string, number, unknown]> = [
        [{}, new mongoose.Types.ObjectId().toString(), 403, forbidden],
        [
          { user: { _id: new mongoose.Types.ObjectId() } },
          'bad-id',
          400,
          { message: 'Cannot interpret id.' },
        ],
      ];
      for (const [req, id, status, body] of cases) {
        const res = deferredResponse();
        await avatarController.userForAvatarByUserId(req, res, () => {}, id);
        [res.statusCode, res.body].should.eql([status, body]);
      }
    });

    it('loads only the avatar fields of the profile and calls next', async () => {
      const [viewer, target] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      await User.updateOne(
        { _id: target._id },
        {
          avatarVersion: 'a'.repeat(32),
          blocked: [viewer._id],
          updated: new Date(),
        },
      );
      let nextCalled = false;
      const req: AvatarRequest & {
        profile?: import('mongoose').Document & AvatarUser;
      } = { user: viewer };
      await avatarController.userForAvatarByUserId(
        req,
        deferredResponse(),
        () => {
          nextCalled = true;
        },
        target._id.toString(),
      );
      nextCalled.should.be.true();
      Object.keys(req.profile!.toObject())
        .sort()
        .should.eql([
          '_id',
          'avatarSource',
          'avatarUploaded',
          'avatarVersion',
          'blocked',
          'emailHash',
          'public',
          'roles',
          'updated',
        ]);
      req.profile!._id.toString().should.equal(target._id.toString());
    });
  });

  describe('getAvatar', () => {
    const ownerId = new mongoose.Types.ObjectId();
    const viewerId = new mongoose.Types.ObjectId();
    const owner = { _id: ownerId, roles: ['user'] };
    const viewer = { _id: viewerId, roles: ['user'] };
    const profile = (overrides: Partial<AvatarUser> = {}): AvatarUser => ({
      _id: ownerId,
      public: true,
      roles: ['user'],
      avatarSource: 'local',
      avatarUploaded: true,
      ...overrides,
    });
    const domain = (https = false) =>
      `${https ? 'https' : 'http'}://${config.domain}`;
    const fallback = (size = 128, https = false) =>
      `${domain(https)}/img/avatar-${size}.png`;
    const local = (version = '', stamp = '', https = false) =>
      `${domain(https)}/uploads-profile/${ownerId}/avatar/${version}128.jpg?${stamp}`;
    const updated = new Date('2026-01-02T03:04:05.000Z');
    const invalid = (message: string) => [400, { message }];
    const cases: Array<[string, AvatarRequest, unknown[] | string, boolean?]> =
      [
        [
          'rejects an invalid size',
          { user: owner, profile: profile(), query: { size: '9999' } },
          invalid(
            'Invalid size. Please use one of these: 2048, 1024, 512, 256, 128, 64, 36, 32, 24, 16',
          ),
        ],
        [
          'defaults without a profile',
          { user: owner, query: { size: '' } },
          fallback(1024),
        ],
        [
          'uses https for the default avatar when configured',
          { user: owner, query: { size: '128' } },
          fallback(128, true),
          true,
        ],
        [
          'hides a private profile',
          { user: viewer, profile: profile({ public: false }) },
          fallback(),
        ],
        [
          'hides a suspended profile',
          { user: viewer, profile: profile({ roles: ['user', 'suspended'] }) },
          fallback(),
        ],
        [
          'hides a shadowbanned profile',
          { user: viewer, profile: profile({ roles: ['user', 'shadowban'] }) },
          fallback(),
        ],
        [
          'hides a profile that blocked the viewer',
          { user: viewer, profile: profile({ blocked: [ownerId, viewerId] }) },
          fallback(),
        ],
        [
          'shows a profile that blocked someone else',
          { user: viewer, profile: profile({ blocked: [ownerId] }) },
          local(),
        ],
        [
          'lets admins see a shadowbanned profile',
          {
            user: { _id: viewerId, roles: ['user', 'admin'] },
            profile: profile({ roles: ['user', 'shadowban'] }),
          },
          local(),
        ],
        [
          'ignores a source requested by a non-owner',
          { user: viewer, profile: profile(), query: { source: 'none' } },
          local(),
        ],
        [
          'rejects an unknown source from the owner',
          { user: owner, profile: profile(), query: { source: 'facebook' } },
          invalid(
            'Invalid source. Please use one of these: none, gravatar, local',
          ),
        ],
        [
          'rejects a new Gravatar selection',
          { user: owner, profile: profile(), query: { source: 'gravatar' } },
          invalid(
            'Gravatar can no longer be selected. Please upload a photo or choose no photo.',
          ),
        ],
        [
          'falls back for an owner-selected source without an upload',
          {
            user: owner,
            profile: profile({ avatarUploaded: false }),
            query: { source: 'local' },
          },
          fallback(),
        ],
        [
          'falls back for an unnormalised legacy source',
          { user: owner, profile: profile({ avatarSource: 'facebook' }) },
          fallback(),
        ],
        [
          'adds the update timestamp and server-owned version',
          {
            user: owner,
            profile: profile({ updated, avatarVersion: 'f'.repeat(32) }),
          },
          local(`${'f'.repeat(32)}/`, String(updated.getTime())),
        ],
        [
          'uses https for local avatars when configured',
          { user: owner, profile: profile() },
          local('', '', true),
          true,
        ],
        [
          'ignores a malformed version',
          { user: owner, profile: profile({ avatarVersion: '0'.repeat(33) }) },
          local(),
        ],
        [
          'keeps a retained Gravatar',
          {
            user: owner,
            profile: profile({ avatarSource: 'gravatar', emailHash: 'abc123' }),
            query: { source: 'gravatar' },
          },
          `https://gravatar.com/avatar/abc123?s=128&d=${encodeURIComponent(
            'https://trustroots.org/img/avatar-128.png',
          )}`,
        ],
        [
          'falls back for a Gravatar without an email hash',
          { user: viewer, profile: profile({ avatarSource: 'gravatar' }) },
          fallback(),
        ],
      ];
    cases.forEach(([name, req, expected, https = false]) => {
      it(name, () => {
        const originalHttps = config.https;
        config.https = https;
        const res = deferredResponse();
        try {
          loadAvatarWithStubs().getAvatar(
            { ...req, query: { size: '128', ...req.query } },
            res,
          );
        } finally {
          config.https = originalHttps;
        }
        if (typeof expected === 'string') {
          [res.statusCode, res.redirectUrl].should.eql([302, expected]);
        } else {
          [res.statusCode, res.body].should.eql(expected);
        }
      });
    });
  });

  describe('avatarUpload', () => {
    const OLD = 'a'.repeat(32);
    const NEW = 'b'.repeat(32);
    const avatarDirectory = '/private/avatar-dir';
    const uploaded = [200, { message: 'Avatar image uploaded.' }];
    const failure = new Error('anonymous failure');
    const log = (message: string): AvatarLogEntry => ({
      level: 'error',
      message: `User profile avatar upload: ${message}`,
      detail: failure,
    });

    interface UploadCase {
      previous?: string;
      processingError?: boolean;
      missingUpload?: boolean;
      unlinkFails?: boolean;
      queueFull?: boolean;
      saveError?: unknown;
      saveMessage?: string;
      lookup?: [Error | null, string | null];
      removeFails?: boolean;
    }
    async function upload(c: UploadCase) {
      const logged: AvatarLogEntry[] = [];
      const removed: string[] = [];
      const lookups: unknown[][] = [];
      const { path: sourcePath } = createTemporaryUpload();
      if (c.missingUpload) fs.unlinkSync(sourcePath);
      const stubs: Record<string, unknown> = {
        [loggerPath]: (level: string, message: string, detail?: unknown) =>
          logged.push({ level, message, detail }),
        '../services/avatar-processing.server.service': {
          enqueueAvatarProcessing: (job: AvatarProcessingJob) => {
            if (c.queueFull) return false;
            process.nextTick(() =>
              c.processingError
                ? job.callback(failure)
                : job.callback(null, { version: NEW, avatarDirectory }),
            );
            return true;
          },
          removeAvatarVersion: async (directory: string, version: string) => {
            directory.should.equal(avatarDirectory);
            removed.push(version);
            if (c.removeFails) throw failure;
          },
        },
      };
      if (c.unlinkFails) {
        stubs.fs = {
          promises: {
            unlink: async () => {
              throw Object.assign(failure, { code: 'EACCES' });
            },
          },
        };
      }
      if (c.saveMessage !== undefined) {
        stubs['./../../../core/server/services/error.server.service.mjs'] = {
          getErrorMessage: () => c.saveMessage,
        };
      }
      const user: UploadUser = {
        _id: new mongoose.Types.ObjectId(),
        avatarVersion: c.previous,
        save: async () => {
          if (c.saveError) throw c.saveError;
        },
      };
      const originalFindById = User.findById;
      replaceAvatarVersionLookup(...(c.lookup ?? [null, NEW]), lookups);
      const res = deferredResponse();
      try {
        loadAvatarWithStubs(stubs).avatarUpload(
          { user, file: { path: sourcePath } },
          res,
        );
        await res.waitForResponse();
      } finally {
        User.findById = originalFindById;
      }
      if (lookups.length) lookups.should.eql([[user._id, 'avatarVersion']]);
      return {
        response: [res.statusCode, res.body],
        logged,
        removed,
        avatarVersion: user.avatarVersion,
        uploadKept: fs.existsSync(sourcePath),
      };
    }

    const cases: Array<[string, UploadCase, Record<string, unknown>]> = [
      [
        'logs a failed temporary cleanup after a processing error',
        { previous: OLD, processingError: true, unlinkFails: true },
        {
          response: [
            422,
            { message: 'Failed to process image, please try again.' },
          ],
          logged: [
            log('failed to clean out temporary image.'),
            log('failed to generate thumbnails.'),
          ],
          avatarVersion: OLD,
          uploadKept: true,
        },
      ],
      [
        'does not log an already removed temporary upload',
        { previous: OLD, processingError: true, missingUpload: true },
        {
          response: [
            422,
            { message: 'Failed to process image, please try again.' },
          ],
          logged: [log('failed to generate thumbnails.')],
          avatarVersion: OLD,
        },
      ],
      [
        'restores the pointer and removes the new version when saving fails',
        {
          previous: OLD,
          saveError: {
            errors: { avatarVersion: { message: 'Invalid avatar.' } },
          },
        },
        {
          response: [400, { message: 'Invalid avatar.' }],
          removed: [NEW],
          avatarVersion: OLD,
        },
      ],
      [
        'logs a failed version cleanup and falls back to a save message',
        {
          previous: OLD,
          saveError: failure,
          saveMessage: '',
          removeFails: true,
        },
        {
          response: [
            400,
            { message: 'Failed to save the new avatar version.' },
          ],
          logged: [log('failed to clean up unpublished avatar version.')],
          removed: [NEW],
          avatarVersion: OLD,
        },
      ],
      [
        'logs a failed pointer verification without failing the upload',
        { previous: OLD, lookup: [failure, null] },
        { logged: [log('failed to verify current avatar version.')] },
      ],
      [
        'keeps the previous version when another upload replaced the pointer',
        { previous: OLD, lookup: [null, 'c'.repeat(32)] },
        {},
      ],
      [
        'keeps the previous version when the user is gone',
        { previous: OLD, lookup: [null, null] },
        {},
      ],
      [
        'removes the previous version once published',
        { previous: OLD },
        {
          removed: [OLD],
        },
      ],
      [
        'logs a failed previous version cleanup after publishing',
        { previous: OLD, removeFails: true },
        {
          logged: [log('failed to remove the previous avatar version.')],
          removed: [OLD],
        },
      ],
      ...[undefined, 'legacy', `${OLD}a`, NEW].map(
        previous =>
          [
            `does not remove the unsafe or current previous version ${previous}`,
            { previous },
            {},
          ] as [string, UploadCase, Record<string, unknown>],
      ),
      [
        'returns 503 and removes the upload when the queue is full',
        { previous: OLD, queueFull: true },
        {
          response: [
            503,
            { message: 'Avatar processing is busy. Please try again shortly.' },
          ],
          avatarVersion: OLD,
        },
      ],
    ];
    cases.forEach(([name, uploadCase, expected]) => {
      it(name, async () => {
        (await upload(uploadCase)).should.eql({
          response: uploaded,
          logged: [],
          removed: [],
          avatarVersion: NEW,
          uploadKept: false,
          ...expected,
        });
      });
    });

    it('publishes a complete avatar version on the stored user', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = (await User.findById(user._id))!;
      userDoc.avatarVersion = OLD;
      await userDoc.save();
      const { path: sourcePath } = createTemporaryUpload();
      const removed: string[] = [];
      let job: AvatarProcessingJob | undefined;
      const controller = loadAvatarWithStubs({
        './../../server/services/avatar-processing.server.service.mts': {
          enqueueAvatarProcessing: (value: AvatarProcessingJob) => {
            job = value;
            return true;
          },
          removeAvatarVersion: async (_directory: string, version: string) => {
            removed.push(version);
          },
        } satisfies AvatarProcessor,
      });
      const res = deferredResponse();

      controller.avatarUpload(
        {
          user: userDoc as unknown as UploadUser,
          file: { path: sourcePath },
        },
        res,
      );
      job!.sourcePath.should.equal(sourcePath);
      job!.userId.should.equal(userDoc._id);
      job!.callback(null, { version: NEW, avatarDirectory });
      await res.waitForResponse();

      [res.statusCode, res.body].should.eql(uploaded);
      (await User.findById(user._id))!.avatarVersion!.should.equal(NEW);
      removed.should.eql([OLD]);
      fs.existsSync(sourcePath).should.equal(false);
    });
  });
});
