const assert: typeof import('assert') = require('assert');
require('should');
const fs: typeof import('node:fs/promises') = require('fs').promises;
const path: typeof import('node:path') = require('path');
const proxyquire: typeof import('../../../../testutils/server/mock-module.mts').default = require('./../../../../testutils/server/mock-module');

const config: typeof import('../../../../config/config.mts').default = require('./../../../../config/config.mts');
const actualFs: typeof import('node:fs/promises') = require('fs').promises;
interface AvatarFailureOptions {
  metadata?: { format: string; width: number; height: number; pages?: number };
  metadataError?: Error;
  outputSize?: number;
  outputWidth?: number;
  outputHeight?: number;
  writeError?: Error;
  thumbnailBytes?: string;
  fallback?: boolean;
  onWrite?: () => void;
  onMetadata?: () => void | Promise<void>;
}
interface AvatarServiceResult {
  version: string;
  versionDirectory: string;
}
interface AvatarFailureService {
  processAvatar(options: {
    sourcePath: string;
    userId: string;
  }): Promise<AvatarServiceResult>;
  maxQueuedUploads: number;
  enqueueAvatarProcessing(job: AvatarJob): boolean;
}
interface AvatarJob {
  sourcePath?: string;
  userId?: string;
  callback(error?: Error | null, result?: AvatarServiceResult): void;
}
interface SharpPipeline {
  timeout(): this;
  autoOrient(): this;
  flatten(): this;
  resize(size: number): this;
  sharpen(): this;
  toColourspace(): this;
  jpeg(): this;
  metadata(): Promise<NonNullable<AvatarFailureOptions['metadata']>>;
  toFile(outputPath: string): Promise<{ width: number; height: number }>;
}
interface SharpFactory {
  (sourcePath: string): SharpPipeline;
  concurrency(threads: number): void;
}
interface FsHooks {
  mkdir?: (
    path: string,
    options: { recursive?: boolean; mode?: number },
  ) => Promise<string | undefined>;
  stat?: (path: string) => Promise<{ size: number }>;
  rename?: (oldPath: string, newPath: string) => Promise<void>;
  copyFile?: (source: string, destination: string) => Promise<void>;
  chmod?: (path: string, mode: number) => Promise<void>;
  rm?: (path: string, options?: import('node:fs').RmOptions) => Promise<void>;
}
const validUserId = '0123456789abcdef01234567';
// What the mocked backend and logger observed during the current test.
let seen: {
  opened: number;
  writes: number;
  logged: unknown[][];
};

function createBackend(options: AvatarFailureOptions = {}): SharpFactory {
  const open = (): SharpPipeline => {
    seen.opened++;
    let size = 0;
    return {
      timeout() {
        return this;
      },
      autoOrient() {
        return this;
      },
      flatten() {
        return this;
      },
      resize(width: number) {
        size = width;
        return this;
      },
      sharpen() {
        return this;
      },
      toColourspace() {
        return this;
      },
      jpeg() {
        return this;
      },
      async metadata() {
        await options.onMetadata?.();
        if (options.metadataError) throw options.metadataError;
        return options.metadata || { format: 'png', width: 600, height: 600 };
      },
      async toFile(outputPath: string) {
        seen.writes++;
        options.onWrite?.();
        if (options.writeError) throw options.writeError;
        await actualFs.writeFile(
          outputPath,
          options.thumbnailBytes || 'mock thumbnail bytes',
        );
        return {
          width: options.outputWidth ?? options.outputSize ?? size,
          height: options.outputHeight ?? options.outputSize ?? size,
        };
      },
    };
  };
  return Object.assign(open, { concurrency() {} });
}

const unusedBackend = Object.assign(
  () => {
    throw new Error('native processor should not be used');
  },
  { concurrency() {} },
);

function createFsProxy(hooks: FsHooks = {}): typeof actualFs {
  return new Proxy(actualFs, {
    get(target, property) {
      if (typeof property === 'string' && property in hooks) {
        return hooks[property as keyof FsHooks];
      }
      const method = Reflect.get(target, property, target);
      return typeof method === 'function' ? method.bind(target) : method;
    },
  });
}

describe('Avatar processing failure handling', () => {
  let temporaryRoot: string;
  let previousNodeEnv: string | undefined;
  let previousFallback: string | undefined;

  beforeEach(async () => {
    const testTempRoot = path.resolve('.tmp');
    await fs.mkdir(testTempRoot, { recursive: true });
    temporaryRoot = await fs.mkdtemp(path.resolve('.tmp/avatar-failures-'));
    previousNodeEnv = process.env.NODE_ENV;
    previousFallback = process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;
    process.env.NODE_ENV = 'test';
    delete process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;
    seen = { opened: 0, writes: 0, logged: [] };
  });

  afterEach(async () => {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
    if (previousFallback === undefined) {
      delete process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;
    } else {
      process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK = previousFallback;
    }
    if (temporaryRoot) {
      await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  async function makeService(
    options: AvatarFailureOptions = {},
    fsHooks: FsHooks = {},
    useDefaultTempDir = false,
  ) {
    const inputPath = path.join(temporaryRoot, 'input.png');
    const uploadDir = path.join(temporaryRoot, 'public');
    const uploadTmpDir = path.join(temporaryRoot, 'private');
    await fs.mkdir(uploadTmpDir, { recursive: true });
    await fs.writeFile(inputPath, 'anonymous source bytes');
    const serviceConfig: Record<string, unknown> = {
      ...config,
      uploadDir,
    };
    if (!useDefaultTempDir) {
      serviceConfig.uploadTmpDir = uploadTmpDir;
    } else {
      delete serviceConfig.uploadTmpDir;
    }
    return {
      inputPath,
      uploadDir,
      uploadTmpDir,
      service: proxyquire<AvatarFailureService>(
        require.resolve('./../../server/services/avatar-processing.server.service.mts'),
        {
          './../../../../config/config.mts': {
            ...serviceConfig,
          },
          fs: { promises: createFsProxy(fsHooks) },
          sharp: createBackend(options),
          './../../../../config/lib/logger.mjs': (...args: unknown[]) =>
            seen.logged.push(args),
        },
      ),
    };
  }

  async function expectProcessingFailure(
    options: AvatarFailureOptions,
    pattern: RegExp,
    fsHooks?: FsHooks,
  ): Promise<void> {
    const { inputPath, service } = await makeService(options, fsHooks);
    await assert.rejects(
      service.processAvatar({ sourcePath: inputPath, userId: validUserId }),
      pattern,
    );
    seen.logged.should.be.empty();
  }

  it('rejects unsupported owner identifiers before creating public files', async () => {
    const { inputPath, service } = await makeService();
    for (const userId of ['../outside', `x${validUserId}`, `${validUserId}x`]) {
      await assert.rejects(
        service.processAvatar({ sourcePath: inputPath, userId }),
        /Invalid avatar owner id/,
      );
    }
  });

  it('uses the operating-system temporary directory when no private path is configured', async () => {
    process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK = 'true';
    const { inputPath, service } = await makeService({}, {}, true);
    const result = await service.processAvatar({
      sourcePath: inputPath,
      userId: validUserId,
    });
    (await fs.readdir(result.versionDirectory)).should.have.length(7);
  });

  it('rejects animated, oversized and unsupported input before writing thumbnails', async () => {
    for (const [metadata, pattern] of [
      [{ format: 'gif', width: 600, height: 600, pages: 2 }, /single-frame/],
      [{ format: 'png', width: 10001, height: 1 }, /dimensions/],
      [{ format: 'svg', width: 600, height: 600 }, /Unsupported image format/],
    ] as const) {
      await expectProcessingFailure({ metadata }, pattern);
    }
    seen.writes.should.equal(0);
  });

  it('rejects input metadata errors and native thumbnail write errors', async () => {
    await expectProcessingFailure(
      { metadataError: new Error('metadata failed') },
      /metadata failed/,
    );
    await expectProcessingFailure(
      { writeError: new Error('write failed') },
      /write failed/,
    );
  });

  it('rejects wrong thumbnail dimensions and invalid output file sizes', async () => {
    await expectProcessingFailure({ outputWidth: 1 }, /unexpected dimensions/);
    await expectProcessingFailure({ outputHeight: 1 }, /unexpected dimensions/);
    await expectProcessingFailure({ thumbnailBytes: 'x' }, /invalid file size/);
    await expectProcessingFailure({}, /invalid file size/, {
      stat: async thumbnailPath => {
        if (thumbnailPath.endsWith('/2048.jpg')) {
          return { size: 8 * 1024 * 1024 + 1 };
        }
        return actualFs.stat(thumbnailPath);
      },
    });
  });

  it('publishes boundary-sized thumbnails from an owner-only public stage', async () => {
    const stageModes: number[] = [];
    const { inputPath, service } = await makeService(
      { thumbnailBytes: 'abcd' },
      {
        rename: async (from, to) => {
          stageModes.push((await actualFs.stat(from)).mode & 0o777);
          return actualFs.rename(from, to);
        },
        stat: async thumbnailPath =>
          thumbnailPath.endsWith('/64.jpg')
            ? { size: 8 * 1024 * 1024 }
            : actualFs.stat(thumbnailPath),
      },
    );
    const result = await service.processAvatar({
      sourcePath: inputPath,
      userId: validUserId,
    });
    (await fs.readdir(result.versionDirectory)).should.have.length(7);
    stageModes.should.eql([0o700]);
    seen.opened.should.equal(8);
  });

  it('removes failed public staging after a publication rename error', async () => {
    const rename = async () => {
      throw new Error('rename failed');
    };
    await expectProcessingFailure({ fallback: true }, /rename failed/, {
      rename,
    });
    const avatarDirectory = path.join(
      temporaryRoot,
      'public',
      validUserId,
      'avatar',
    );
    (await fs.readdir(avatarDirectory)).should.be.empty();
  });

  it('removes an incomplete public stage when copying a thumbnail fails', async () => {
    const copyFile = async (source: string, destination: string) => {
      if (destination.includes('.staging-')) {
        throw new Error('public copy failed');
      }
      return actualFs.copyFile(source, destination);
    };
    await expectProcessingFailure({ fallback: true }, /public copy failed/, {
      copyFile,
    });
    const avatarDirectory = path.join(
      temporaryRoot,
      'public',
      validUserId,
      'avatar',
    );
    (await fs.readdir(avatarDirectory)).should.be.empty();
  });

  it('removes an unpublished version if final permissions cannot be applied', async () => {
    let failedPublicPermission = false;
    const chmod = async (filePath: string, mode: number) => {
      if (mode === 0o755 && !failedPublicPermission) {
        failedPublicPermission = true;
        throw new Error('chmod failed');
      }
      return actualFs.chmod(filePath, mode);
    };
    await expectProcessingFailure({ fallback: true }, /chmod failed/, {
      chmod,
    });
    const avatarDirectory = path.join(
      temporaryRoot,
      'public',
      validUserId,
      'avatar',
    );
    (await fs.readdir(avatarDirectory)).should.be.empty();
  });

  it('logs cleanup failures for both public and private staging', async () => {
    const logged: Array<[unknown, string, ...unknown[]]> = [];
    const renameFailure = new Error('rename failed');
    const publicCleanupFs = createFsProxy({
      rename: async () => {
        throw renameFailure;
      },
      rm: async (filePath, options) => {
        if (filePath.includes('.staging-')) {
          throw new Error('public cleanup failed');
        }
        return actualFs.rm(filePath, options);
      },
    });
    const { inputPath } = await makeService();
    const publicCleanupService = proxyquire<AvatarFailureService>(
      require.resolve('./../../server/services/avatar-processing.server.service.mts'),
      {
        './../../../../config/config.mts': {
          ...config,
          uploadDir: path.join(temporaryRoot, 'public'),
          uploadTmpDir: path.join(temporaryRoot, 'private'),
        },
        fs: { promises: publicCleanupFs },
        sharp: unusedBackend,
        './../../../../config/lib/logger.mjs': (
          ...args: [unknown, string, ...unknown[]]
        ) => logged.push(args),
      },
    );
    process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK = 'true';
    await assert.rejects(
      publicCleanupService.processAvatar({
        sourcePath: inputPath,
        userId: validUserId,
      }),
      /rename failed/,
    );
    logged.should.have.length(1);
    logged[0]
      .slice(0, 2)
      .should.eql([
        'error',
        'Avatar processing failed to clean its public staging directory.',
      ]);

    const privateCleanupFs = createFsProxy({
      chmod: async (filePath, mode) => {
        if (mode === 0o755) {
          throw new Error('chmod failed');
        }
        return actualFs.chmod(filePath, mode);
      },
      rm: async (filePath, options) => {
        if (filePath.includes('trustroots-avatar-')) {
          throw new Error('private cleanup failed');
        }
        return actualFs.rm(filePath, options);
      },
    });
    const privateCleanupService = proxyquire<AvatarFailureService>(
      require.resolve('./../../server/services/avatar-processing.server.service.mts'),
      {
        './../../../../config/config.mts': {
          ...config,
          uploadDir: path.join(temporaryRoot, 'public-private-cleanup'),
          uploadTmpDir: path.join(temporaryRoot, 'private'),
        },
        fs: { promises: privateCleanupFs },
        sharp: createBackend(),
        './../../../../config/lib/logger.mjs': (
          ...args: [unknown, string, ...unknown[]]
        ) => logged.push(args),
      },
    );
    await assert.rejects(
      privateCleanupService.processAvatar({
        sourcePath: inputPath,
        userId: validUserId,
      }),
      /chmod failed/,
    );
    logged[1]
      .slice(0, 2)
      .should.eql([
        'error',
        'Avatar processing failed to clean its private staging directory.',
      ]);
  });

  it('logs a cleanup failure for a version that could not be published', async () => {
    const logged: Array<[unknown, string, ...unknown[]]> = [];
    const chmod = async (filePath: string, mode: number) => {
      if (mode === 0o755) {
        throw new Error('chmod failed');
      }
      return actualFs.chmod(filePath, mode);
    };
    const rm = async (
      filePath: string,
      options?: import('node:fs').RmOptions,
    ) => {
      if (filePath.match(/\/avatar\/[a-f0-9]{32}$/)) {
        throw new Error('version cleanup failed');
      }
      return actualFs.rm(filePath, options);
    };
    const { inputPath } = await makeService();
    const service = proxyquire<AvatarFailureService>(
      require.resolve('./../../server/services/avatar-processing.server.service.mts'),
      {
        './../../../../config/config.mts': {
          ...config,
          uploadDir: path.join(temporaryRoot, 'public-version-cleanup'),
          uploadTmpDir: path.join(temporaryRoot, 'private'),
        },
        fs: { promises: createFsProxy({ chmod, rm }) },
        sharp: unusedBackend,
        './../../../../config/lib/logger.mjs': (
          ...args: [unknown, string, ...unknown[]]
        ) => logged.push(args),
      },
    );
    process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK = 'true';
    await assert.rejects(
      service.processAvatar({ sourcePath: inputPath, userId: validUserId }),
      /chmod failed/,
    );
    logged[0]
      .slice(0, 2)
      .should.eql([
        'error',
        'Avatar processing failed to clean its unpublished version directory.',
      ]);
  });

  it('rejects processing when its 60-second deadline expires at each publication stage', async () => {
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;
    const deadlines = ['metadata', 'native', 'private', 'public', 'published'];

    try {
      for (const deadlineStage of deadlines) {
        if (['metadata', 'native'].includes(deadlineStage)) {
          delete process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;
        } else {
          process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK = 'true';
        }
        let expire: (() => void) | undefined;
        let cleared = false;
        let staged = false;
        let renamed = false;
        global.setTimeout = ((callback: () => void, delay?: number) => {
          if (delay === 60000) {
            expire = callback;
            return { deadline: true } as unknown as NodeJS.Timeout;
          }
          return originalSetTimeout(callback, delay);
        }) as typeof global.setTimeout;
        global.clearTimeout = ((timer?: NodeJS.Timeout) => {
          if (!timer || !('deadline' in timer)) {
            return originalClearTimeout(timer);
          }
          cleared = true;
          return undefined;
        }) as typeof global.clearTimeout;
        const fireDeadline = () => {
          if (!expire) throw new Error('Expected test deadline timer');
          expire();
        };
        const copyFile = async (source: string, destination: string) => {
          if (
            (deadlineStage === 'private' && destination.endsWith('/32.jpg')) ||
            (deadlineStage === 'public' && destination.includes('.staging-'))
          ) {
            fireDeadline();
          }
          staged ||= destination.includes('.staging-');
          return actualFs.copyFile(source, destination);
        };
        const chmod = async (filePath: string, mode: number) => {
          if (deadlineStage === 'published' && mode === 0o755) {
            fireDeadline();
          }
          return actualFs.chmod(filePath, mode);
        };
        const rename = async (from: string, to: string) => {
          renamed = true;
          return actualFs.rename(from, to);
        };
        const { inputPath, service } = await makeService(
          {
            metadata: { onMetadata: fireDeadline },
            native: { onWrite: fireDeadline },
          }[deadlineStage] ?? {},
          { copyFile, chmod, rename },
        );
        await assert.rejects(
          service.processAvatar({ sourcePath: inputPath, userId: validUserId }),
          /exceeded its time limit/,
        );
        cleared.should.be.true();
        // Each stage stops at the first deadline check after it.
        staged.should.equal(['public', 'published'].includes(deadlineStage));
        renamed.should.equal(deadlineStage === 'published');
        seen.writes.should.equal(deadlineStage === 'native' ? 1 : 0);
        seen.writes = 0;
      }
    } finally {
      global.setTimeout = originalSetTimeout;
      global.clearTimeout = originalClearTimeout;
    }
  });

  it('releases processing slots when the deadline expires during metadata inspection', async () => {
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;
    const expires: Array<() => void> = [];
    const metadataReleases: Array<() => void> = [];
    global.setTimeout = ((callback: () => void, delay?: number) => {
      if (delay === 60000) {
        expires.push(callback);
        return { deadline: true } as unknown as NodeJS.Timeout;
      }
      return originalSetTimeout(callback, delay);
    }) as typeof global.setTimeout;
    global.clearTimeout = ((timer?: NodeJS.Timeout) => {
      if (!timer || !('deadline' in timer)) {
        return originalClearTimeout(timer);
      }
      return undefined;
    }) as typeof global.clearTimeout;
    try {
      const { inputPath, service } = await makeService({
        onMetadata: () =>
          seen.opened <= 2
            ? new Promise<void>(resolve => metadataReleases.push(resolve))
            : undefined,
      });
      const enqueue = () =>
        new Promise<Error | null | undefined>(resolve => {
          service
            .enqueueAvatarProcessing({
              sourcePath: inputPath,
              userId: validUserId,
              callback: error => resolve(error),
            })
            .should.be.true();
        });
      const outcomes = [enqueue(), enqueue()];
      while (metadataReleases.length < 2) {
        await new Promise<void>(resolve => setImmediate(resolve));
      }
      outcomes.push(enqueue());
      await new Promise<void>(resolve => setImmediate(resolve));
      seen.opened.should.equal(2);
      expires.forEach(expire => expire());
      metadataReleases.forEach(release => release());
      const [first, second, third] = await Promise.all(outcomes);
      assert.match(String(first?.message), /exceeded its time limit/);
      assert.match(String(second?.message), /exceeded its time limit/);
      assert.equal(third, null);
      seen.writes.should.equal(7);
    } finally {
      global.setTimeout = originalSetTimeout;
      global.clearTimeout = originalClearTimeout;
    }
  });

  it('calls throwing failure callbacks once and rejects a full queue', async () => {
    const service = proxyquire<AvatarFailureService>(
      require.resolve('./../../server/services/avatar-processing.server.service.mts'),
      {
        './../../../../config/config.mts': config,
        './../../../../config/lib/logger.mjs': (...args: unknown[]) =>
          seen.logged.push(args),
      },
    );
    const callbacks: Array<Error | null | undefined> = [];
    const jobs = Array.from<unknown, Promise<Error | null | undefined>>(
      { length: 2 },
      (_, index) =>
        new Promise<Error | null | undefined>(resolve => {
          const accepted = service.enqueueAvatarProcessing({
            userId: `invalid-${index}`,
            callback: error => {
              callbacks.push(error);
              resolve(error);
              throw new Error('callback failed');
            },
          });
          accepted.should.be.true();
        }),
    );

    service
      .enqueueAvatarProcessing({ userId: 'invalid-extra', callback() {} })
      .should.be.false();
    (await Promise.all(jobs)).forEach(error => {
      if (!(error instanceof Error)) {
        throw new Error(
          'Expected queued upload to report its validation error',
        );
      }
      error.message.should.match(/Invalid avatar owner id/);
    });
    await new Promise(resolve => setImmediate(resolve));
    callbacks.should.have.length(2);
    seen.logged
      .map(entry => entry.slice(0, 2))
      .should.eql(
        Array(2).fill(['error', 'Avatar processing callback failed.']),
      );
  });

  it('limits active processing to two and drains a full pending queue after failures', async () => {
    const releases: Array<() => void> = [];
    let started = 0;
    const { inputPath, service } = await makeService(
      {},
      {
        mkdir: () =>
          new Promise((_resolve, reject) => {
            started++;
            releases.push(() => reject(new Error('staging failed')));
          }),
      },
    );
    const completed: Array<Promise<void>> = [];
    const enqueue = () => {
      let finish!: () => void;
      completed.push(
        new Promise<void>(resolve => {
          finish = resolve;
        }),
      );
      return service.enqueueAvatarProcessing({
        sourcePath: inputPath,
        userId: validUserId,
        callback: error => {
          assert.equal(error?.message, 'staging failed');
          finish();
        },
      });
    };
    assert.equal(enqueue(), true);
    assert.equal(enqueue(), true);
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(started, 2);
    for (let i = 0; i < service.maxQueuedUploads; i++)
      assert.equal(enqueue(), true);
    assert.equal(service.enqueueAvatarProcessing({ callback() {} }), false);
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(started, 2);
    releases.shift()!();
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(started, 3);
    while (releases.length) releases.shift()!();
    await new Promise<void>(resolve => setImmediate(resolve));
    while (releases.length) releases.shift()!();
    await Promise.all(completed);
  });

  it('calls a throwing success callback once with the upload result', async () => {
    process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK = 'true';
    const inputPath = path.join(temporaryRoot, 'queue-input.png');
    await fs.writeFile(inputPath, 'anonymous source bytes');
    const service = proxyquire<AvatarFailureService>(
      require.resolve('./../../server/services/avatar-processing.server.service.mts'),
      {
        './../../../../config/config.mts': {
          ...config,
          uploadDir: path.join(temporaryRoot, 'queue-public'),
          uploadTmpDir: path.join(temporaryRoot, 'queue-private'),
        },
      },
    );
    let callbackCount = 0;
    const result = await new Promise<AvatarServiceResult>((resolve, reject) => {
      service
        .enqueueAvatarProcessing({
          sourcePath: inputPath,
          userId: validUserId,
          callback: (error, value) => {
            callbackCount++;
            if (error) {
              reject(error);
            } else if (!value) {
              reject(new Error('Expected queued upload result'));
            } else {
              resolve(value);
              throw new Error('success callback failed');
            }
          },
        })
        .should.be.true();
    });
    await new Promise(resolve => setImmediate(resolve));
    callbackCount.should.equal(1);
    (await fs.readdir(result.versionDirectory)).should.have.length(7);
  });
});
