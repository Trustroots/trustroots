const assert: typeof import('assert') = require('assert');
const EventEmitter: typeof import('node:events').EventEmitter = require('events');
const fs: typeof import('node:fs/promises') = require('fs').promises;
const path: typeof import('node:path') = require('path');
const proxyquire: typeof import('../../../../testutils/server/mock-module.mts').default = require('./../../../../testutils/server/mock-module');

const config: typeof import('../../../../config/config.mts').default = require('./../../../../config/config.mts');
interface ProcessorCommand {
  args(): string[];
}
interface AvatarResult {
  version: string;
  versionDirectory: string;
}
interface AvatarProcessingService {
  createLimitedCommand(
    sourcePath: string,
    cancellationEmitter?: InstanceType<typeof EventEmitter>,
  ): ProcessorCommand;
  validateDimensions(output: string): void;
  validateResourceList(output: string | Buffer): void;
  processAvatar(options: {
    sourcePath: string;
    userId: string;
  }): Promise<AvatarResult>;
  removeAvatarVersion(avatarDirectory: string, version: string): Promise<void>;
}
interface ImageMagickCommand {
  args: string[];
  commandOptions: { timeout: number };
  options(options: { timeout: number }): this;
  in(...args: string[]): this;
  addDisposer(): this;
}
interface ImageMagickProcessingService extends Omit<
  AvatarProcessingService,
  'createLimitedCommand'
> {
  createLimitedCommand(
    sourcePath: string,
    cancellationEmitter?: InstanceType<typeof EventEmitter>,
  ): ImageMagickCommand;
}
const avatarProcessing: AvatarProcessingService = require('./../../server/services/avatar-processing.server.service.mjs');
require('should');

describe('Avatar processing service', () => {
  const gmLimits = [
    ['memory', '192M'],
    ['map', '256M'],
    ['disk', '128M'],
    ['pixels', '40MP'],
    ['width', '10000'],
    ['height', '10000'],
    ['threads', '1'],
    ['read', '40M'],
  ];
  const imLimits = [
    ['memory', '192MiB'],
    ['map', '256MiB'],
    ['disk', '128MiB'],
    ['area', '40MP'],
    ['width', '10000'],
    ['height', '10000'],
    ['file', '16'],
    ['thread', '1'],
    ['time', '15'],
  ];
  const limitArgs = (limits: string[][]) =>
    limits.flatMap(([name, value]) => ['-limit', name, value]);
  const resourceList = (limits: string[][]) =>
    limits.map(([name, value]) => `${name}: ${value}`).join('\n');
  function loadImageMagickService() {
    const disposers: unknown[][] = [];
    const imageMagickCommand = (): ImageMagickCommand => ({
      args: [] as string[],
      commandOptions: { timeout: 0 },
      options(options: { timeout: number }) {
        this.commandOptions = options;
        return this;
      },
      in(...args: string[]) {
        this.args.push(...args);
        return this;
      },
      addDisposer(...args: unknown[]) {
        disposers.push(args);
        return this;
      },
    });
    const imageMagick = Object.assign(
      () => {
        throw new Error('GraphicsMagick must not be used');
      },
      {
        subClass: (options: { imageMagick: boolean }) => {
          options.should.deepEqual({ imageMagick: true });
          return () => imageMagickCommand();
        },
      },
    );
    const service = proxyquire<ImageMagickProcessingService>(
      require.resolve('./../../server/services/avatar-processing.server.service.mts'),
      {
        './../../../../config/config.mts': {
          ...config,
          imageProcessor: 'imagemagic',
        },
        gm: imageMagick,
      },
    );
    return { service, disposers };
  }

  describe('resource limits', () => {
    it('places exactly the GraphicsMagick limits before the untrusted input path', () => {
      for (const inputPath of ['/private/upload-123', '/private/upload-456']) {
        const args = avatarProcessing
          .createLimitedCommand(inputPath, new EventEmitter())
          .args();
        const inputIndex = args.indexOf(inputPath);

        args
          .slice(args.indexOf('-limit'), inputIndex)
          .should.eql(limitArgs(gmLimits));
        args.slice(inputIndex + 1).should.not.containEql('-limit');
      }
    });

    it('selects ImageMagick limits and cancels only commands given an emitter', () => {
      const { service, disposers } = loadImageMagickService();
      const emitter = new EventEmitter();

      const command = service.createLimitedCommand('/private/upload', emitter);
      service.createLimitedCommand('/private/upload-without-cancellation');

      command.args.should.eql(limitArgs(imLimits));
      command.commandOptions.timeout.should.equal(15000);
      disposers.should.eql([[emitter, ['timeout']]]);
    });
  });

  describe('input validation', () => {
    it('accepts single frames up to the dimension and pixel limits', () => {
      for (const output of [
        '600 600',
        ' 600  600 \n\n',
        '10000 1',
        '1 10000',
        '10000 4000',
      ]) {
        assert.strictEqual(
          avatarProcessing.validateDimensions(output),
          undefined,
        );
      }
    });

    it('rejects multiple frames and malformed frames', () => {
      for (const output of [
        '600 600\n600 600',
        '600\n600',
        '600',
        '600 600 600',
      ]) {
        assert.throws(
          () => avatarProcessing.validateDimensions(output),
          /single-frame/,
          output,
        );
      }
    });

    it('rejects dimensions beyond the configured limits', () => {
      for (const output of [
        '1.5 600',
        '600 1.5',
        '0 600',
        '600 0',
        '10001 1',
        '1 10001',
        '8000 6000',
      ]) {
        assert.throws(
          () => avatarProcessing.validateDimensions(output),
          /dimensions/,
          output,
        );
      }
    });

    it('accepts complete resource lists, including aliases and padded names', () => {
      const { service } = loadImageMagickService();
      for (const [validate, list] of [
        [
          avatarProcessing.validateResourceList,
          `Resource limits:\n  Memory : 192M\n${resourceList(gmLimits.slice(1))}`,
        ],
        [
          avatarProcessing.validateResourceList,
          resourceList(gmLimits).replace('threads', 'Thread'),
        ],
        [service.validateResourceList, resourceList(imLimits)],
        [
          service.validateResourceList,
          resourceList(imLimits)
            .replace('file', 'Files')
            .replace('thread', 'Threads'),
        ],
      ] as const) {
        assert.strictEqual(validate(list), undefined, list);
      }
    });

    it('fails closed when the selected backend omits a resource limit', () => {
      assert.throws(
        () => avatarProcessing.validateResourceList('Memory: 192M\nMap: 256M'),
        {
          message:
            'Image processor does not support required resource limits: disk, pixels, width, height, threads, read.',
        },
      );
      assert.throws(
        () =>
          avatarProcessing.validateResourceList(
            resourceList(gmLimits).replace('memory', '1-memory'),
          ),
        /limits: memory\.$/,
      );
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
      const service = proxyquire<AvatarProcessingService>(
        require.resolve('./../../server/services/avatar-processing.server.service.mts'),
        {
          './../../../../config/config.mts': {
            ...config,
            uploadDir,
            uploadTmpDir: tempDir,
          },
        },
      );

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

  describe('native processor orchestration with a mocked backend', () => {
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

    it('processes seven outputs with limits configured before each input', async () => {
      const inputPath = path.join(temporaryRoot, 'input.png');
      const uploadDir = path.join(temporaryRoot, 'public');
      const tempDir = path.join(temporaryRoot, 'temp');
      await fs.mkdir(tempDir);
      await fs.writeFile(inputPath, 'anonymous source');
      const observedInputs: Array<{ sourcePath: string; arguments: string[] }> =
        [];
      const writes: unknown[][][] = [];
      const listenerLimits = new Set<number>();
      const recordChain = function (
        this: { chain: unknown[][] },
        name: string,
        args: unknown[],
      ) {
        this.chain.push([name, ...args]);
        return this;
      };
      const imageProcessor = (sourcePath: string) => {
        const command = {
          arguments: [] as string[],
          chain: [] as unknown[][],
          in(...args: string[]) {
            this.arguments.push(...args);
            return this;
          },
          options() {
            return this;
          },
          addDisposer(emitter: InstanceType<typeof EventEmitter>) {
            listenerLimits.add(emitter.getMaxListeners());
            return this;
          },
          command() {
            return this;
          },
          toBuffer(callback: (error: Error | null, output: Buffer) => void) {
            callback(
              null,
              Buffer.from(
                [
                  'Memory: 192M',
                  'Map: 256M',
                  'Disk: 128M',
                  'Pixels: 40MP',
                  'Width: 10000',
                  'Height: 10000',
                  'File: 16',
                  'Threads: 1',
                  'Read: 40M',
                  'Write: 8M',
                  'Area: 40MP',
                  'Thread: 1',
                  'Time: 15',
                ].join('\n'),
              ),
            );
          },
          autoOrient(...args: unknown[]) {
            return recordChain.call(this, 'autoOrient', args);
          },
          noProfile(...args: unknown[]) {
            return recordChain.call(this, 'noProfile', args);
          },
          colorspace(...args: unknown[]) {
            return recordChain.call(this, 'colorspace', args);
          },
          interlace(...args: unknown[]) {
            return recordChain.call(this, 'interlace', args);
          },
          filter(...args: unknown[]) {
            return recordChain.call(this, 'filter', args);
          },
          resize(...args: unknown[]) {
            return recordChain.call(this, 'resize', args);
          },
          gravity(...args: unknown[]) {
            return recordChain.call(this, 'gravity', args);
          },
          extent(...args: unknown[]) {
            return recordChain.call(this, 'extent', args);
          },
          unsharp(...args: unknown[]) {
            return recordChain.call(this, 'unsharp', args);
          },
          quality(...args: unknown[]) {
            return recordChain.call(this, 'quality', args);
          },
          identify(
            _options: { format: string },
            callback: (error: Error | null, output: string) => void,
          ) {
            observedInputs.push({
              sourcePath,
              arguments: this.arguments.slice(),
            });
            const match = sourcePath.match(/\/(\d+)\.jpg$/);
            callback(null, match ? `${match[1]} ${match[1]}` : '600 600');
          },
          write(outputPath: string, callback: (error?: Error | null) => void) {
            writes.push(this.chain);
            observedInputs.push({
              sourcePath,
              arguments: this.arguments.slice(),
            });
            fs.writeFile(outputPath, 'mock thumbnail bytes').then(() =>
              callback(),
            );
          },
        };
        return command;
      };
      const service = proxyquire<AvatarProcessingService>(
        require.resolve('./../../server/services/avatar-processing.server.service.mts'),
        {
          './../../../../config/config.mts': {
            ...config,
            uploadDir,
            uploadTmpDir: tempDir,
          },
          gm: imageProcessor,
        },
      );

      const result = await service.processAvatar({
        sourcePath: inputPath,
        userId: '0123456789abcdef01234567',
      });

      (await fs.readdir(result.versionDirectory)).should.have.length(7);
      observedInputs.length.should.equal(15);
      [...listenerLimits].should.eql([23]);
      writes.should.eql(
        [2048, 1024, 512, 256, 128, 64, 32].map(size => [
          ['autoOrient'],
          ['noProfile'],
          ['colorspace', 'rgb'],
          ['interlace', 'None'],
          ['filter', 'Triangle'],
          ['resize', size, `${size}^`],
          ['gravity', 'Center'],
          ['extent', size, size],
          ['unsharp', 0.25, 0.25, 8, 0.065],
          ['quality', 82],
        ]),
      );
      for (const observation of observedInputs) {
        observation.arguments.should.containEql('-limit');
        observation.arguments.should.containEql('memory');
      }
    });
  });
});
