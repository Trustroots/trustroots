const assert = require('assert');
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const proxyquire = require('proxyquire').noCallThru();

const config = require('../../../../config/config');
const avatarProcessing = require('../../server/services/avatar-processing.server.service');
require('should');

describe('Avatar processing service', () => {
  describe('resource limits', () => {
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
      const imageMagickCommand = () => ({
        args: [],
        options(options) {
          this.commandOptions = options;
          return this;
        },
        in(...args) {
          this.args.push(...args);
          return this;
        },
        addDisposer() {
          return this;
        },
      });
      const imageMagick = Object.assign(() => imageMagickCommand(), {
        subClass: options => {
          options.should.deepEqual({ imageMagick: true });
          return () => imageMagickCommand();
        },
      });
      const service = proxyquire(
        '../../server/services/avatar-processing.server.service',
        {
          '../../../../config/config': imageMagickConfig,
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
  });

  describe('private staging and publication', () => {
    let temporaryRoot;
    let previousNodeEnv;
    let previousFallback;

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
      const service = proxyquire(
        '../../server/services/avatar-processing.server.service',
        {
          '../../../../config/config': {
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
    let temporaryRoot;
    let previousNodeEnv;
    let previousFallback;

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
      const observedInputs = [];
      const imageProcessor = sourcePath => {
        const command = {
          arguments: [],
          in(...args) {
            this.arguments.push(...args);
            return this;
          },
          options() {
            return this;
          },
          addDisposer() {
            return this;
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
          identify(_options, callback) {
            observedInputs.push({
              sourcePath,
              arguments: this.arguments.slice(),
            });
            const match = sourcePath.match(/\/(\d+)\.jpg$/);
            callback(null, match ? `${match[1]} ${match[1]}` : '600 600');
          },
          write(outputPath, callback) {
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
      const service = proxyquire(
        '../../server/services/avatar-processing.server.service',
        {
          '../../../../config/config': {
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
