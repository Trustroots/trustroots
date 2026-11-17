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
            ...(sharpModule ? { sharp: sharpModule } : {}),
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
