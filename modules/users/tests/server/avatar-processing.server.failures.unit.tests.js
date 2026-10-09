const assert = require('assert');
const fs = require('fs').promises;
const path = require('path');
const proxyquire = require('./../../../../testutils/server/mock-module');

const config = require('./../../../../config/config.mjs');
const actualFs = require('fs').promises;
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

function createBackend(options = {}) {
  const imageProcessor = sourcePath => ({
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
    toBuffer(callback) {
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
    identify(_format, callback) {
      if (options.identifyError && sourcePath === options.inputPath) {
        callback(options.identifyError);
        return;
      }
      const match = sourcePath.match(/\/(\d+)\.jpg$/);
      callback(
        null,
        match
          ? options.outputDimensions || `${match[1]} ${match[1]}`
          : '600 600',
      );
    },
    write(outputPath, callback) {
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

function createFsProxy(hooks = {}) {
  return new Proxy(actualFs, {
    get(target, property) {
      if (hooks[property]) {
        return hooks[property];
      }
      return target[property].bind(target);
    },
  });
}

describe('Avatar processing failure handling', () => {
  let temporaryRoot;
  let previousNodeEnv;
  let previousFallback;

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
    options = {},
    fsHooks = {},
    useDefaultTempDir = false,
  ) {
    const inputPath = path.join(temporaryRoot, 'input.png');
    const uploadDir = path.join(temporaryRoot, 'public');
    const uploadTmpDir = path.join(temporaryRoot, 'private');
    await fs.mkdir(uploadTmpDir, { recursive: true });
    await fs.writeFile(inputPath, 'anonymous source bytes');
    const serviceConfig = {
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
      service: proxyquire(
        require.resolve(
          './../../server/services/avatar-processing.server.service.mjs',
        ),
        {
          './../../../../config/config.mjs': {
            ...serviceConfig,
          },
          fs: { promises: createFsProxy(fsHooks) },
          gm: createBackend({ ...options, inputPath }),
          './../../../../config/lib/logger.mjs': () => {},
        },
      ),
    };
  }

  async function expectProcessingFailure(options, pattern, fsHooks) {
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
    const copyFile = async (source, destination) => {
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
    const chmod = async (filePath, mode) => {
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
    const logged = [];
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
    const publicCleanupService = proxyquire(
      require.resolve(
        './../../server/services/avatar-processing.server.service.mjs',
      ),
      {
        './../../../../config/config.mjs': {
          ...config,
          uploadDir: path.join(temporaryRoot, 'public'),
          uploadTmpDir: path.join(temporaryRoot, 'private'),
        },
        fs: { promises: publicCleanupFs },
        gm: () => {
          throw new Error('not used');
        },
        './../../../../config/lib/logger.mjs': (...args) => logged.push(args),
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
    const privateCleanupService = proxyquire(
      require.resolve(
        './../../server/services/avatar-processing.server.service.mjs',
      ),
      {
        './../../../../config/config.mjs': {
          ...config,
          uploadDir: path.join(temporaryRoot, 'public-private-cleanup'),
          uploadTmpDir: path.join(temporaryRoot, 'private'),
        },
        fs: { promises: privateCleanupFs },
        gm: createBackend({ inputPath }),
        './../../../../config/lib/logger.mjs': (...args) => logged.push(args),
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
    const logged = [];
    const chmod = async (filePath, mode) => {
      if (mode === 0o755) {
        throw new Error('chmod failed');
      }
      return actualFs.chmod(filePath, mode);
    };
    const rm = async (filePath, options) => {
      if (filePath.match(/\/avatar\/[a-f0-9]{32}$/)) {
        throw new Error('version cleanup failed');
      }
      return actualFs.rm(filePath, options);
    };
    const { inputPath } = await makeService();
    const service = proxyquire(
      require.resolve(
        './../../server/services/avatar-processing.server.service.mjs',
      ),
      {
        './../../../../config/config.mjs': {
          ...config,
          uploadDir: path.join(temporaryRoot, 'public-version-cleanup'),
          uploadTmpDir: path.join(temporaryRoot, 'private'),
        },
        fs: { promises: createFsProxy({ chmod, rm }) },
        gm: () => {
          throw new Error('native processor should not be used');
        },
        './../../../../config/lib/logger.mjs': (...args) => logged.push(args),
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
        let expire;
        global.setTimeout = (callback, delay) => {
          if (delay === 60000) {
            expire = callback;
            return { deadline: true };
          }
          return originalSetTimeout(callback, delay);
        };
        global.clearTimeout = timer => {
          if (!timer || !timer.deadline) {
            return originalClearTimeout(timer);
          }
          return undefined;
        };
        const fireDeadline = () => expire();
        const copyFile = async (source, destination) => {
          if (
            (deadlineStage === 'private' && destination.endsWith('/32.jpg')) ||
            (deadlineStage === 'public' && destination.includes('.staging-'))
          ) {
            fireDeadline();
          }
          return actualFs.copyFile(source, destination);
        };
        const chmod = async (filePath, mode) => {
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
    const service = proxyquire(
      require.resolve(
        './../../server/services/avatar-processing.server.service.mjs',
      ),
      {
        './../../../../config/config.mjs': config,
        gm: require('gm'),
      },
    );
    const callbacks = [];
    const jobs = Array.from(
      { length: 2 },
      (_, index) =>
        new Promise(resolve => {
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
    (await Promise.all(jobs)).forEach(error =>
      error.message.should.match(/Invalid avatar owner id/),
    );
    callbacks.should.have.length(2);
  });

  it('rejects uploads when the pending queue reaches its configured limit', () => {
    const pending = [];
    const service = proxyquire(
      require.resolve(
        './../../server/services/avatar-processing.server.service.mjs',
      ),
      {
        async: {
          queue: () => ({
            length: () => pending.length,
            push: job => pending.push(job),
          }),
        },
        './../../../../config/config.mjs': config,
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
    const service = proxyquire(
      require.resolve(
        './../../server/services/avatar-processing.server.service.mjs',
      ),
      {
        './../../../../config/config.mjs': {
          ...config,
          uploadDir: path.join(temporaryRoot, 'queue-public'),
          uploadTmpDir: path.join(temporaryRoot, 'queue-private'),
        },
        gm: require('gm'),
      },
    );
    const result = await new Promise((resolve, reject) => {
      service
        .enqueueAvatarProcessing({
          sourcePath: inputPath,
          userId: validUserId,
          callback: (error, value) => (error ? reject(error) : resolve(value)),
        })
        .should.be.true();
    });
    (await fs.readdir(result.versionDirectory)).should.have.length(7);
  });
});
