import assert from 'assert';
import path from 'path';
import mockModule from './../../../../testutils/server/mock-module.mts';
import config from './../../../../config/config.mts';
import avatarProcessing from './../../server/services/avatar-processing.server.service.mts';
import 'should';
import sharp, { type FormatEnum, type Metadata } from 'sharp';
import fs from 'node:fs/promises';

interface AvatarResult {
  version: string;
  versionDirectory: string;
}
interface AvatarProcessingService {
  validateDimensions(
    metadata: Pick<Metadata, 'format' | 'width' | 'height' | 'pages'>,
  ): void;
  processAvatar(options: {
    sourcePath: string;
    userId: string;
  }): Promise<AvatarResult>;
  removeAvatarVersion(avatarDirectory: string, version: string): Promise<void>;
}

describe('Avatar processing service', () => {
  const image = (
    width: number,
    height: number,
    pages?: number,
  ): Pick<Metadata, 'format' | 'width' | 'height' | 'pages'> => ({
    format: 'png',
    width,
    height,
    pages,
  });

  describe('input validation', () => {
    it('accepts single frames up to the dimension and pixel limits', () => {
      for (const metadata of [
        image(600, 600),
        image(600, 600, 1),
        image(10000, 1),
        image(1, 10000),
        image(10000, 4000),
        { ...image(600, 600), format: 'gif' },
        { ...image(600, 600), format: 'jpeg' },
      ] as Array<ReturnType<typeof image>>) {
        assert.strictEqual(
          avatarProcessing.validateDimensions(metadata),
          undefined,
        );
      }
    });

    it('rejects formats other than GIF, JPEG and PNG', () => {
      for (const format of ['svg', 'tiff', 'webp', 'heif', 'pdf'] as Array<
        keyof FormatEnum
      >) {
        assert.throws(
          () =>
            avatarProcessing.validateDimensions({
              ...image(600, 600),
              format,
            }),
          /Unsupported image format/,
          format,
        );
      }
    });

    it('rejects multiple frames', () => {
      for (const pages of [0, 2, 100]) {
        assert.throws(
          () => avatarProcessing.validateDimensions(image(600, 600, pages)),
          /single-frame/,
          String(pages),
        );
      }
    });

    it('rejects dimensions beyond the configured limits', () => {
      for (const [width, height] of [
        [1.5, 600],
        [600, 1.5],
        [0, 600],
        [600, 0],
        [10001, 1],
        [1, 10001],
        [8000, 6000],
      ]) {
        assert.throws(
          () => avatarProcessing.validateDimensions(image(width, height)),
          /dimensions/,
          `${width}x${height}`,
        );
      }
    });
  });

  describe('private staging and publication', () => {
    let temporaryRoot: string;
    let previousNodeEnv: string | undefined;
    let previousFallback: string | undefined;

    beforeEach(async () => {
      const testTempRoot = path.resolve('.tmp');
      await fs.mkdir(testTempRoot, { recursive: true });
      temporaryRoot = await fs.mkdtemp(
        path.join(testTempRoot, 'trustroots-avatar-test-'),
      );
      previousNodeEnv = process.env.NODE_ENV;
      previousFallback = process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;
      process.env.NODE_ENV = 'test';
      process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK = 'true';
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
      await fs.rm(temporaryRoot, { recursive: true, force: true });
    });

    it('publishes a complete versioned set from private staging', async () => {
      const inputPath = path.join(temporaryRoot, 'input.png');
      const uploadDir = path.join(temporaryRoot, 'public');
      const tempDir = path.join(temporaryRoot, 'temp');
      await fs.mkdir(tempDir);
      await fs.writeFile(inputPath, 'anonymous image bytes');
      const service = (
        await mockModule<{ default: AvatarProcessingService }>(
          new URL(
            './../../server/services/avatar-processing.server.service.mts',
            import.meta.url,
          ),
          {
            './../../../../config/config.mts': {
              ...config,
              uploadDir,
              uploadTmpDir: tempDir,
            },
          },
        )
      ).default;

      const result = await service.processAvatar({
        sourcePath: inputPath,
        userId: '0123456789abcdef01234567',
      });
      const names = await fs.readdir(result.versionDirectory);

      result.version.should.match(/^[a-f0-9]{32}$/);
      names.should.have.length(7);
      names.should.containEql('2048.jpg');
      (await fs.readdir(tempDir)).should.be.empty();
      (await fs.stat(result.versionDirectory)).mode
        .toString(8)
        .slice(-3)
        .should.equal('755');
      (await fs.stat(path.join(result.versionDirectory, '2048.jpg'))).mode
        .toString(8)
        .slice(-3)
        .should.equal('644');
    });

    it('removes only the requested valid version directory', async () => {
      const avatarDirectory = path.join(temporaryRoot, 'public', 'avatar');
      const versions = ['1'.repeat(32), '2'.repeat(32)];
      await fs.mkdir(avatarDirectory, { recursive: true });
      for (const version of versions) {
        await fs.mkdir(path.join(avatarDirectory, version));
      }

      await avatarProcessing.removeAvatarVersion(avatarDirectory, versions[0]);

      await avatarProcessing.removeAvatarVersion(avatarDirectory, versions[0]);

      const remaining = await fs.readdir(avatarDirectory);
      remaining.should.eql([versions[1]]);
      for (const invalid of [
        '../other',
        `x${versions[1]}`,
        `${versions[1]}x`,
      ]) {
        await assert.rejects(
          avatarProcessing.removeAvatarVersion(avatarDirectory, invalid),
          /Invalid avatar version/,
        );
      }
    });
  });

  describe('sharp processing', () => {
    let temporaryRoot: string;
    let previousNodeEnv: string | undefined;
    let previousFallback: string | undefined;

    beforeEach(async () => {
      temporaryRoot = await fs.mkdtemp(
        path.resolve('.tmp/avatar-native-mock-'),
      );
      previousNodeEnv = process.env.NODE_ENV;
      previousFallback = process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK;
      // The copy fallback is only honoured in the test environment.
      process.env.NODE_ENV = 'development';
      process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK = 'true';
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
      await fs.rm(temporaryRoot, { recursive: true, force: true });
    });

    async function loadService(sharpModule?: unknown) {
      const uploadDir = path.join(temporaryRoot, 'public');
      const uploadTmpDir = path.join(temporaryRoot, 'temp');
      const native = sharpModule
        ? await mockModule<
            typeof import('../../server/services/avatar-processing.server.image.mts')
          >(
            new URL(
              '../../server/services/avatar-processing.server.image.mts',
              import.meta.url,
            ),
            { sharp: sharpModule },
          )
        : undefined;
      return (
        await mockModule<{ default: AvatarProcessingService }>(
          new URL(
            './../../server/services/avatar-processing.server.service.mts',
            import.meta.url,
          ),
          {
            './../../../../config/config.mts': {
              ...config,
              uploadDir,
              uploadTmpDir,
            },
            ...(native
              ? {
                  './avatar-processing.server.worker.mts':
                    native.createNativeThumbnails,
                }
              : {}),
          },
        )
      ).default;
    }

    it('opens every input with limits and builds seven cropped thumbnails', async () => {
      const inputPath = path.join(temporaryRoot, 'input.png');
      await fs.writeFile(inputPath, 'anonymous source');
      const opened: unknown[][] = [];
      const pipelines: unknown[][][] = [];
      const concurrency: number[] = [];
      const sharpModule = Object.assign(
        (input: string, options: unknown) => {
          opened.push([input, options]);
          const chain: unknown[][] = [];
          const record = (name: string) =>
            function (this: unknown, ...args: unknown[]) {
              chain.push([name, ...args]);
              return this;
            };
          let size = 0;
          return {
            timeout: record('timeout'),
            autoOrient: record('autoOrient'),
            flatten: record('flatten'),
            resize(width: number, ...args: unknown[]) {
              size = width;
              return record('resize').call(this, width, ...args);
            },
            sharpen: record('sharpen'),
            toColourspace: record('toColourspace'),
            jpeg: record('jpeg'),
            metadata: async () => ({ format: 'png', width: 600, height: 400 }),
            async toFile(outputPath: string) {
              pipelines.push(chain);
              await fs.writeFile(outputPath, 'mock thumbnail bytes');
              return { width: size, height: size };
            },
          };
        },
        { concurrency: (threads: number) => concurrency.push(threads) },
      );

      const result = await (
        await loadService(sharpModule)
      ).processAvatar({
        sourcePath: inputPath,
        userId: '0123456789abcdef01234567',
      });

      (await fs.readdir(result.versionDirectory)).should.have.length(7);
      concurrency.should.eql([1]);
      opened.should.eql(
        Array(8).fill([
          inputPath,
          { failOn: 'warning', limitInputPixels: 40000000 },
        ]),
      );
      pipelines.should.eql(
        [2048, 1024, 512, 256, 128, 64, 32].map(size => [
          ['timeout', { seconds: 15 }],
          ['autoOrient'],
          ['flatten', { background: '#ffffff' }],
          ['resize', size, size, { fit: 'cover', kernel: 'linear' }],
          ['sharpen', { sigma: 0.25 }],
          ['toColourspace', 'srgb'],
          ['jpeg', { quality: 82 }],
        ]),
      );
    });

    it('creates seven square JPEG thumbnails from real fixture images', async () => {
      for (const fixture of ['avatar.gif', 'avatar.jpg', 'avatar.png']) {
        const result = await (
          await loadService()
        ).processAvatar({
          sourcePath: path.join(import.meta.dirname, 'img', fixture),
          userId: '0123456789abcdef01234567',
        });
        for (const size of [2048, 1024, 512, 256, 128, 64, 32]) {
          const { format, width, height } = await sharp(
            path.join(result.versionDirectory, `${size}.jpg`),
          ).metadata();
          [format, width, height].should.eql(['jpeg', size, size], fixture);
        }
      }
    });

    it('matches the GraphicsMagick thumbnails of a photo', async () => {
      const result = await (
        await loadService()
      ).processAvatar({
        sourcePath: path.join(import.meta.dirname, 'img', 'avatar-photo.jpg'),
        userId: '0123456789abcdef01234567',
      });
      for (const size of [128, 64, 32]) {
        const [actual, expected] = await Promise.all(
          [
            path.join(result.versionDirectory, `${size}.jpg`),
            path.join(
              import.meta.dirname,
              'img',
              `avatar-photo-gm-${size}.jpg`,
            ),
          ].map(file =>
            sharp(file).raw().toBuffer({ resolveWithObject: true }),
          ),
        );
        actual.info.should.eql(expected.info);
        const squaredError = actual.data.reduce(
          (sum, value, i) => sum + (value - expected.data[i]) ** 2,
          0,
        );
        const psnr =
          10 * Math.log10(255 ** 2 / (squaredError / actual.data.length));
        psnr.should.be.above(30, `${size}px PSNR`);
      }
    });

    it('flattens transparent input onto white', async () => {
      const inputPath = path.join(temporaryRoot, 'transparent.png');
      await sharp({
        create: {
          width: 40,
          height: 30,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .png()
        .toFile(inputPath);

      const result = await (
        await loadService()
      ).processAvatar({
        sourcePath: inputPath,
        userId: '0123456789abcdef01234567',
      });
      const { channels } = await sharp(
        path.join(result.versionDirectory, '32.jpg'),
      ).stats();

      channels.map(channel => channel.min).should.eql([255, 255, 255]);
    });

    it('rejects a fixture whose content is not an image', async () => {
      await assert.rejects(
        (await loadService()).processAvatar({
          sourcePath: path.join(
            import.meta.dirname,
            'img',
            'this-is-text-file.jpg',
          ),
          userId: '0123456789abcdef01234567',
        }),
        /unsupported image format/,
      );
    });
  });
});

describe('Avatar processing failure handling', () => {
  interface AvatarFailureOptions {
    metadata?: {
      format: string;
      width: number;
      height: number;
      pages?: number;
    };
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

  function createBackend(
    options: AvatarFailureOptions,
    signal: AbortSignal,
  ): SharpFactory {
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
          signal.throwIfAborted();
          if (options.metadataError) throw options.metadataError;
          return options.metadata || { format: 'png', width: 600, height: 600 };
        },
        async toFile(outputPath: string) {
          seen.writes++;
          options.onWrite?.();
          signal.throwIfAborted();
          if (options.writeError) throw options.writeError;
          await fs.writeFile(
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

  function mockWorker(options: AvatarFailureOptions = {}) {
    return async (
      sourcePath: string,
      stageDir: string,
      signal: AbortSignal,
    ) => {
      const { createNativeThumbnails } = await mockModule<
        typeof import('../../server/services/avatar-processing.server.image.mts')
      >(
        new URL(
          '../../server/services/avatar-processing.server.image.mts',
          import.meta.url,
        ),
        { sharp: createBackend(options, signal) },
      );
      await createNativeThumbnails(sourcePath, stageDir);
    };
  }

  function unusedWorker() {
    throw new Error('native processor should not be used');
  }

  function createFsProxy(hooks: FsHooks = {}): typeof fs {
    return new Proxy(fs, {
      get(target, property) {
        if (typeof property === 'string' && property in hooks) {
          return hooks[property as keyof FsHooks];
        }
        const method = Reflect.get(target, property, target);
        return typeof method === 'function' ? method.bind(target) : method;
      },
    });
  }

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
      service: (
        await mockModule<{ default: AvatarFailureService }>(
          new URL(
            './../../server/services/avatar-processing.server.service.mts',
            import.meta.url,
          ),
          {
            './../../../../config/config.mts': {
              ...serviceConfig,
            },
            fs: { promises: createFsProxy(fsHooks) },
            './avatar-processing.server.worker.mts': mockWorker(options),
            '@trustroots/logger': (...args: unknown[]) =>
              seen.logged.push(args),
          },
        )
      ).default,
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

  it('accepts single-frame avatars at the pixel limit and defines each output size', async () => {
    const { avatarSizes, validateDimensions } =
      await import('../../server/services/avatar-processing.server.dimensions.mts');
    assert.deepStrictEqual(avatarSizes, [2048, 1024, 512, 256, 128, 64, 32]);
    for (const format of ['gif', 'jpeg', 'png'] as const) {
      assert.doesNotThrow(() =>
        validateDimensions({ format, width: 10000, height: 4000, pages: 1 }),
      );
    }
  });

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
        return fs.stat(thumbnailPath);
      },
    });
  });

  it('publishes boundary-sized thumbnails from an owner-only public stage', async () => {
    const stageModes: number[] = [];
    const { inputPath, service } = await makeService(
      { thumbnailBytes: 'abcd' },
      {
        rename: async (from, to) => {
          stageModes.push((await fs.stat(from)).mode & 0o777);
          return fs.rename(from, to);
        },
        stat: async thumbnailPath =>
          thumbnailPath.endsWith('/64.jpg')
            ? { size: 8 * 1024 * 1024 }
            : fs.stat(thumbnailPath),
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
      return fs.copyFile(source, destination);
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
      return fs.chmod(filePath, mode);
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
        return fs.rm(filePath, options);
      },
    });
    const { inputPath } = await makeService();
    const publicCleanupService = (
      await mockModule<{ default: AvatarFailureService }>(
        new URL(
          './../../server/services/avatar-processing.server.service.mts',
          import.meta.url,
        ),
        {
          './../../../../config/config.mts': {
            ...config,
            uploadDir: path.join(temporaryRoot, 'public'),
            uploadTmpDir: path.join(temporaryRoot, 'private'),
          },
          fs: { promises: publicCleanupFs },
          './avatar-processing.server.worker.mts': unusedWorker,
          '@trustroots/logger': (...args: [unknown, string, ...unknown[]]) =>
            logged.push(args),
        },
      )
    ).default;
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
        return fs.chmod(filePath, mode);
      },
      rm: async (filePath, options) => {
        if (filePath.includes('trustroots-avatar-')) {
          throw new Error('private cleanup failed');
        }
        return fs.rm(filePath, options);
      },
    });
    const privateCleanupService = (
      await mockModule<{ default: AvatarFailureService }>(
        new URL(
          './../../server/services/avatar-processing.server.service.mts',
          import.meta.url,
        ),
        {
          './../../../../config/config.mts': {
            ...config,
            uploadDir: path.join(temporaryRoot, 'public-private-cleanup'),
            uploadTmpDir: path.join(temporaryRoot, 'private'),
          },
          fs: { promises: privateCleanupFs },
          './avatar-processing.server.worker.mts': mockWorker(),
          '@trustroots/logger': (...args: [unknown, string, ...unknown[]]) =>
            logged.push(args),
        },
      )
    ).default;
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
      return fs.chmod(filePath, mode);
    };
    const rm = async (
      filePath: string,
      options?: import('node:fs').RmOptions,
    ) => {
      if (filePath.match(/\/avatar\/[a-f0-9]{32}$/)) {
        throw new Error('version cleanup failed');
      }
      return fs.rm(filePath, options);
    };
    const { inputPath } = await makeService();
    const service = (
      await mockModule<{ default: AvatarFailureService }>(
        new URL(
          './../../server/services/avatar-processing.server.service.mts',
          import.meta.url,
        ),
        {
          './../../../../config/config.mts': {
            ...config,
            uploadDir: path.join(temporaryRoot, 'public-version-cleanup'),
            uploadTmpDir: path.join(temporaryRoot, 'private'),
          },
          fs: { promises: createFsProxy({ chmod, rm }) },
          './avatar-processing.server.worker.mts': unusedWorker,
          '@trustroots/logger': (...args: [unknown, string, ...unknown[]]) =>
            logged.push(args),
        },
      )
    ).default;
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
          return fs.copyFile(source, destination);
        };
        const chmod = async (filePath: string, mode: number) => {
          if (deadlineStage === 'published' && mode === 0o755) {
            fireDeadline();
          }
          return fs.chmod(filePath, mode);
        };
        const rename = async (from: string, to: string) => {
          renamed = true;
          return fs.rename(from, to);
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
    const service = (
      await mockModule<{ default: AvatarFailureService }>(
        new URL(
          './../../server/services/avatar-processing.server.service.mts',
          import.meta.url,
        ),
        {
          './../../../../config/config.mts': config,
          '@trustroots/logger': (...args: unknown[]) => seen.logged.push(args),
        },
      )
    ).default;
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
    const service = (
      await mockModule<{ default: AvatarFailureService }>(
        new URL(
          './../../server/services/avatar-processing.server.service.mts',
          import.meta.url,
        ),
        {
          './../../../../config/config.mts': {
            ...config,
            uploadDir: path.join(temporaryRoot, 'queue-public'),
            uploadTmpDir: path.join(temporaryRoot, 'queue-private'),
          },
        },
      )
    ).default;
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
