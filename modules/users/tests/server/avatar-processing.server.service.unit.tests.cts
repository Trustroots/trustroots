const assert: typeof import('assert') = require('assert');
const EventEmitter: typeof import('node:events').EventEmitter = require('events');
const fs: typeof import('node:fs/promises') = require('fs').promises;
const path: typeof import('node:path') = require('path');
const proxyquire: typeof import('../../../../testutils/server/mock-module.mts').default = require('./../../../../testutils/server/mock-module');

const config: typeof import('../../../../config/config.mjs').default = require('./../../../../config/config.mjs');
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
  describe('resource limits', () => {
    it('applies native limits when no cancellation emitter is provided', () => {
      const args = avatarProcessing
        .createLimitedCommand('/private/upload-without-cancellation')
        .args();

      args.should.containEql('/private/upload-without-cancellation');
      args.should.containEql('-limit');
    });

    it('places GraphicsMagick limits before the untrusted input path', () => {
      const inputPath = '/private/upload-123';
      const args = avatarProcessing
        .createLimitedCommand(inputPath, new EventEmitter())
        .args();
      const inputIndex = args.indexOf(inputPath);

      inputIndex.should.be.above(0);
      args.slice(0, inputIndex).should.containEql('-limit');
      args.slice(0, inputIndex).should.containEql('memory');
      args.slice(0, inputIndex).should.containEql('map');
      args.slice(0, inputIndex).should.containEql('disk');
      args.slice(0, inputIndex).should.containEql('pixels');
      args.slice(0, inputIndex).should.containEql('threads');
      args.slice(inputIndex + 1).should.not.containEql('-limit');
    });

    it('selects ImageMagick limit names explicitly', () => {
      const imageMagickConfig = {
        ...config,
        imageProcessor: 'imagemagic',
      };
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
        addDisposer() {
          return this;
        },
      });
      const imageMagick = Object.assign(() => imageMagickCommand(), {
        subClass: (options: { imageMagick: boolean }) => {
          options.should.deepEqual({ imageMagick: true });
          return () => imageMagickCommand();
        },
      });
      const service = proxyquire<ImageMagickProcessingService>(
        require.resolve('./../../server/services/avatar-processing.server.service.mts'),
        {
          './../../../../config/config.mjs': imageMagickConfig,
          gm: imageMagick,
        },
      );

      const command = service.createLimitedCommand(
        '/private/upload-456',
        new EventEmitter(),
      );
      command.args.should.containEql('area');
      command.args.should.containEql('thread');
      command.args.should.containEql('time');
      command.args.should.not.containEql('pixels');
      command.commandOptions.timeout.should.equal(15000);
    });
  });

  describe('input validation', () => {
    it('accepts a single frame within the pixel and dimension limits', () => {
      assert.strictEqual(
        avatarProcessing.validateDimensions('600 600'),
        undefined,
      );
    });

    it('rejects multiple frames', () => {
      assert.throws(
        () => avatarProcessing.validateDimensions('600 600\n600 600'),
        /single-frame/,
      );
    });

    it('rejects dimensions beyond the configured limits', () => {
      assert.throws(
        () => avatarProcessing.validateDimensions('10001 1'),
        /dimensions/,
      );
      assert.throws(
        () => avatarProcessing.validateDimensions('8000 6000'),
        /dimensions/,
      );
    });

    it('fails closed when the selected backend omits a resource limit', () => {
      assert.throws(
        () => avatarProcessing.validateResourceList('Memory: 192M\nMap: 256M'),
        /does not support required resource limits/,
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
          './../../../../config/config.mjs': {
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

      const remaining = await fs.readdir(avatarDirectory);
      remaining.should.eql([versions[1]]);
      await assert.rejects(
        avatarProcessing.removeAvatarVersion(avatarDirectory, '../other'),
        /Invalid avatar version/,
      );
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
      const imageProcessor = (sourcePath: string) => {
        const command = {
          arguments: [] as string[],
          in(...args: string[]) {
            this.arguments.push(...args);
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
          './../../../../config/config.mjs': {
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
      for (const observation of observedInputs) {
        observation.arguments.should.containEql('-limit');
        observation.arguments.should.containEql('memory');
      }
    });
  });
});
