const assert: typeof import('assert') = require('assert');
require('should');
const fs: typeof import('node:fs/promises') = require('fs').promises;
const path: typeof import('node:path') = require('path');
const proxyquire: typeof import('../../../../testutils/server/mock-module.mts').default = require('./../../../../testutils/server/mock-module');

const config: typeof import('../../../../config/config.mts').default = require('./../../../../config/config.mts');
const actualFs: typeof import('node:fs/promises') = require('fs').promises;
interface AvatarFailureOptions {
  probeError?: Error;
  resourceList?: string;
  inputPath?: string;
  identifyError?: Error;
  outputDimensions?: string;
  writeError?: Error;
  thumbnailBytes?: string;
  fallback?: boolean;
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
  validateNativeResourceLimits(): Promise<void>;
  maxQueuedUploads: number;
  enqueueAvatarProcessing(job: AvatarJob): boolean;
}
interface AvatarJob {
  sourcePath?: string;
  userId?: string;
  callback(error?: Error | null, result?: AvatarServiceResult): void;
}
interface ProcessorCommand {
  in(...args: string[]): this;
  options(options: { timeout: number }): this;
  addDisposer(...args: unknown[]): this;
  command(name: string): this;
  toBuffer(
    callback: (error: Error | undefined | null, output: Buffer) => void,
  ): void;
  autoOrient(): this;
  noProfile(): this;
  colorspace(value: string): this;
  interlace(value: string): this;
  filter(value: string): this;
  resize(width: number, height: string): this;
  gravity(value: string): this;
  extent(width: number, height: number): this;
  unsharp(...values: number[]): this;
  quality(value: number): this;
  identify(
    format: { format: string },
    callback: (error: Error | undefined | null, output?: string) => void,
  ): void;
  write(outputPath: string, callback: (error?: Error | null) => void): void;
}
interface BackendFactory {
  (sourcePath: string | null): ProcessorCommand;
}
interface FsHooks {
  stat?: (path: string) => Promise<{ size: number }>;
  rename?: (oldPath: string, newPath: string) => Promise<void>;
  copyFile?: (source: string, destination: string) => Promise<void>;
  chmod?: (path: string, mode: number) => Promise<void>;
  rm?: (path: string, options?: import('node:fs').RmOptions) => Promise<void>;
}
const validUserId = '0123456789abcdef01234567';
const resourceList = [
  'Memory: 192M',
  'Map: 256M',
  'Disk: 128M',
  'Pixels: 40MP',
  'Width: 10000',
  'Height: 10000',
  'Threads: 1',
  'Read: 40M',
].join('\n');

function createBackend(options: AvatarFailureOptions = {}): BackendFactory {
  const imageProcessor: BackendFactory = (sourcePath: string | null) => ({
    in() {
      return this;
    },
    options() {
      return this;
    },
    addDisposer() {
      return this;
    },
    command() {
      return this;
    },
    toBuffer(
      callback: (error: Error | undefined | null, output: Buffer) => void,
    ) {
      callback(
        options.probeError,
        Buffer.from(options.resourceList || resourceList),
      );
    },
    autoOrient() {
      return this;
    },
    noProfile() {
      return this;
    },
    colorspace() {
      return this;
    },
    interlace() {
      return this;
    },
    filter() {
      return this;
    },
    resize() {
      return this;
    },
    gravity() {
      return this;
    },
    extent() {
      return this;
    },
    unsharp() {
      return this;
    },
    quality() {
      return this;
    },
    identify(
      _format: { format: string },
      callback: (error: Error | undefined | null, output: string) => void,
    ) {
      if (options.identifyError && sourcePath === options.inputPath) {
        callback(options.identifyError, '');
        return;
      }
      const match = sourcePath?.match(/\/(\d+)\.jpg$/);
      callback(
        null,
        match
          ? options.outputDimensions || `${match[1]} ${match[1]}`
          : '600 600',
      );
    },
    write(outputPath: string, callback: (error?: Error | null) => void) {
      if (options.writeError) {
        callback(options.writeError);
        return;
      }
      actualFs
        .writeFile(outputPath, options.thumbnailBytes || 'mock thumbnail bytes')
        .then(() => callback())
        .catch(callback);
    },
  });

  return imageProcessor;
}

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
          gm: createBackend({ ...options, inputPath }),
          './../../../../config/lib/logger.mjs': () => {},
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
  }

  it('rejects unsupported owner identifiers before creating public files', async () => {
    const { inputPath, service } = await makeService();
    await assert.rejects(
      service.processAvatar({ sourcePath: inputPath, userId: '../outside' }),
      /Invalid avatar owner id/,
    );
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

  it('resets a failed native capability probe so the next upload retries', async () => {
    const failure = new Error('probe failed');
    const { inputPath, service } = await makeService({ probeError: failure });
    await assert.rejects(
      service.processAvatar({ sourcePath: inputPath, userId: validUserId }),
      /probe failed/,
    );
    await fs.rm(path.join(temporaryRoot, 'private'), {
      recursive: true,
      force: true,
    });

    const retry = await makeService();
    const result = await retry.service.processAvatar({
      sourcePath: retry.inputPath,
      userId: validUserId,
    });
    (await fs.readdir(result.versionDirectory)).should.have.length(7);
  });

  it('rejects a native capability list that cannot be parsed completely', async () => {
    await expectProcessingFailure(
      { resourceList: 'Memory: 192M\nMap: 256M' },
      /does not support required resource limits/,
    );
  });

  it('reuses the successful native resource capability result', async () => {
    const { inputPath, service } = await makeService();
    await service.validateNativeResourceLimits();
    await service.validateNativeResourceLimits();
    void inputPath;
  });

  it('rejects input identify errors and native thumbnail write errors', async () => {
    await expectProcessingFailure(
      { identifyError: new Error('identify failed') },
      /identify failed/,
    );
    await expectProcessingFailure(
      { writeError: new Error('write failed') },
      /write failed/,
    );
  });

  it('rejects wrong thumbnail dimensions and invalid output file sizes', async () => {
    await expectProcessingFailure(
      { outputDimensions: '1 1' },
      /unexpected dimensions/,
    );
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
        gm: () => {
          throw new Error('not used');
        },
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
    logged[0][1].should.match(/public staging directory/);

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
        gm: createBackend({ inputPath }),
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
    logged[1][1].should.match(/private staging directory/);
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
        gm: () => {
          throw new Error('native processor should not be used');
        },
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
    logged[0][1].should.match(/unpublished version directory/);
  });

  it('rejects processing when its 60-second deadline expires at each publication stage', async () => {
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;
    const deadlines = ['private', 'public', 'published'];

    try {
      for (const deadlineStage of deadlines) {
        process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK = 'true';
        let expire: (() => void) | undefined;
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
          return actualFs.copyFile(source, destination);
        };
        const chmod = async (filePath: string, mode: number) => {
          if (deadlineStage === 'published' && mode === 0o755) {
            fireDeadline();
          }
          return actualFs.chmod(filePath, mode);
        };
        const { inputPath, service } = await makeService(
          {},
          { copyFile, chmod },
        );
        await assert.rejects(
          service.processAvatar({ sourcePath: inputPath, userId: validUserId }),
          /exceeded its time limit/,
        );
      }
    } finally {
      global.setTimeout = originalSetTimeout;
      global.clearTimeout = originalClearTimeout;
    }
  });

  it('forwards queue processing failures to each callback and rejects a full queue', async () => {
    const service = proxyquire<AvatarFailureService>(
      require.resolve('./../../server/services/avatar-processing.server.service.mts'),
      {
        './../../../../config/config.mts': config,
        gm: require('gm'),
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
    callbacks.should.have.length(2);
  });

  it('rejects uploads when the pending queue reaches its configured limit', () => {
    const pending: AvatarJob[] = [];
    const service = proxyquire<AvatarFailureService>(
      require.resolve('./../../server/services/avatar-processing.server.service.mts'),
      {
        async: {
          queue: () => ({
            length: () => pending.length,
            push: (job: AvatarJob) => pending.push(job),
          }),
        },
        './../../../../config/config.mts': config,
        gm: require('gm'),
      },
    );

    for (let index = 0; index < service.maxQueuedUploads; index += 1) {
      service.enqueueAvatarProcessing({ callback() {} }).should.be.true();
    }
    service.enqueueAvatarProcessing({ callback() {} }).should.be.false();
  });

  it('forwards a successful queued upload result to its callback', async () => {
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
        gm: require('gm'),
      },
    );
    const result = await new Promise<AvatarServiceResult>((resolve, reject) => {
      service
        .enqueueAvatarProcessing({
          sourcePath: inputPath,
          userId: validUserId,
          callback: (error, value) => {
            if (error) {
              reject(error);
            } else if (!value) {
              reject(new Error('Expected queued upload result'));
            } else {
              resolve(value);
            }
          },
        })
        .should.be.true();
    });
    (await fs.readdir(result.versionDirectory)).should.have.length(7);
  });
});
