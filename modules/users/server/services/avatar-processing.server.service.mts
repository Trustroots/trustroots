import EventEmitter from 'events';
import dependency2 from 'fs';
import gm, { type Command as GmCommand } from 'gm';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import config from './../../../../config/config.mts';
import log from './../../../../config/lib/logger.mjs';
import type { EventEmitter as EventEmitterType } from 'node:events';
import type {
  AvatarProcessingJob,
  AvatarProcessingResult,
  AvatarProcessingService,
} from './avatar-processing.server.types.mts';
const fs = dependency2.promises;
const avatarSizes = [2048, 1024, 512, 256, 128, 64, 32];
const maxWidth = 10000;
const maxHeight = 10000;
const maxPixels = 40 * 1000 * 1000;
const maxThumbnailBytes = 8 * 1024 * 1024;
const processorTimeoutMs = 15000;
const uploadProcessingTimeoutMs = 60000;
const maxQueuedUploads = 2;
const imageProcessor: typeof gm =
  config.imageProcessor === 'imagemagic'
    ? gm.subClass({
        imageMagick: true,
      })
    : gm;
let nativeCapabilitiesPromise: Promise<void> | undefined;
function getNativeResourceLimits(): Array<[string, string]> {
  if (config.imageProcessor === 'imagemagic') {
    return [
      ['memory', '192MiB'],
      ['map', '256MiB'],
      ['disk', '128MiB'],
      ['area', '40MP'],
      ['width', String(maxWidth)],
      ['height', String(maxHeight)],
      ['file', '16'],
      ['thread', '1'],
      ['time', '15'],
    ];
  }
  return [
    ['memory', '192M'],
    ['map', '256M'],
    ['disk', '128M'],
    ['pixels', '40MP'],
    ['width', String(maxWidth)],
    ['height', String(maxHeight)],
    ['threads', '1'],
    ['read', '40M'],
  ];
}
function createLimitedCommand(
  sourcePath: string | null,
  cancellationEmitter?: EventEmitterType,
): GmCommand {
  const command = imageProcessor(sourcePath).options({
    timeout: processorTimeoutMs,
  });
  if (cancellationEmitter) {
    command.addDisposer(cancellationEmitter, ['timeout']);
  }

  // GraphicsMagick and ImageMagick read resource limits before the input file.
  // Keep these in `in` args so a decoder cannot allocate before the limits apply.
  getNativeResourceLimits().forEach(([name, value]) => {
    command.in('-limit', name, value);
  });
  return command;
}
function validateResourceList(output: string | Buffer): void {
  const available = new Set(
    output
      .toString()
      .split(/\r?\n/)
      .map(line => line.match(/^\s*([a-z]+)\s*:/i))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map(match => match[1].toLowerCase()),
  );
  const aliases: Record<string, string[]> = {
    file: ['file', 'files'],
    files: ['file', 'files'],
    threads: ['thread', 'threads'],
    thread: ['thread', 'threads'],
  };
  const missing = getNativeResourceLimits()
    .map(([name]) => name.toLowerCase())
    .filter(
      name =>
        !(aliases[name] || [name]).some(resource => available.has(resource)),
    );
  if (missing.length > 0) {
    throw new Error(
      `Image processor does not support required resource limits: ${missing.join(
        ', ',
      )}.`,
    );
  }
}
function validateNativeResourceLimits(
  cancellationEmitter?: EventEmitterType,
): Promise<void> {
  if (!nativeCapabilitiesPromise) {
    nativeCapabilitiesPromise = new Promise((resolve, reject) => {
      const command = createLimitedCommand(null, cancellationEmitter)
        .command('convert')
        .in('-list', 'resource');
      command.toBuffer((error, output) => {
        if (error) {
          nativeCapabilitiesPromise = undefined;
          return reject(error);
        }
        try {
          validateResourceList(output!);
          resolve();
        } catch (validationError) {
          nativeCapabilitiesPromise = undefined;
          reject(validationError);
        }
      });
    });
  }
  return nativeCapabilitiesPromise;
}
function identify(command: GmCommand): Promise<string> {
  return new Promise((resolve, reject) => {
    command.identify(
      {
        format: '%w %h\n',
      },
      (error, output) => {
        if (error) {
          return reject(error);
        }
        resolve(output);
      },
    );
  });
}
function validateDimensions(output: string): void {
  const frames = output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.split(/\s+/).map(Number));
  if (frames.length !== 1 || frames[0].length !== 2) {
    throw new Error('Only single-frame images are supported.');
  }
  const [width, height] = frames[0];
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > maxWidth ||
    height > maxHeight ||
    width * height > maxPixels
  ) {
    throw new Error('Image dimensions exceed the supported limits.');
  }
}
function runNativeCommand(
  command: GmCommand,
  outputPath: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    command.write(outputPath, error => {
      if (error) {
        return reject(error);
      }
      resolve();
    });
  });
}
function validateVersion(version: string): void {
  if (!/^[a-f0-9]{32}$/.test(version)) {
    throw new Error('Invalid avatar version.');
  }
}
async function createPrivateStage(): Promise<string> {
  const configuredTempDir = path.resolve(config.uploadTmpDir || os.tmpdir());
  await fs.mkdir(configuredTempDir, {
    recursive: true,
    mode: 0o700,
  });
  return fs.mkdtemp(path.join(configuredTempDir, 'trustroots-avatar-'));
}
async function copyTestThumbnails(sourcePath: string, stageDir: string) {
  for (const size of avatarSizes) {
    await fs.copyFile(sourcePath, path.join(stageDir, `${size}.jpg`));
  }
}
async function createNativeThumbnails(
  sourcePath: string,
  stageDir: string,
  cancellationEmitter: EventEmitterType,
) {
  // Fail closed if the installed native build does not expose every resource
  // limit used below. This command has no untrusted input to decode.
  await validateNativeResourceLimits(cancellationEmitter);
  validateDimensions(
    await identify(createLimitedCommand(sourcePath, cancellationEmitter)),
  );
  for (const size of avatarSizes) {
    const command = createLimitedCommand(sourcePath, cancellationEmitter)
      .autoOrient()
      .noProfile()
      .colorspace('rgb')
      .interlace('None')
      .filter('Triangle')
      .resize(size, `${size}^`)
      .gravity('Center')
      .extent(size, size)
      .unsharp(0.25, 0.25, 8, 0.065)
      .quality(82);
    await runNativeCommand(command, path.join(stageDir, `${size}.jpg`));
    const outputDimensions = await identify(
      createLimitedCommand(
        path.join(stageDir, `${size}.jpg`),
        cancellationEmitter,
      ),
    );
    validateDimensions(outputDimensions);
    if (outputDimensions !== `${size} ${size}`) {
      throw new Error('Generated avatar thumbnail has unexpected dimensions.');
    }
  }
}
async function validateThumbnails(stageDir: string) {
  for (const size of avatarSizes) {
    const thumbnailPath = path.join(stageDir, `${size}.jpg`);
    const stat = await fs.stat(thumbnailPath);
    if (stat.size < 4 || stat.size > maxThumbnailBytes) {
      throw new Error('Generated avatar thumbnail has an invalid file size.');
    }
  }
}
async function copyToPublicStage(
  stageDir: string,
  avatarDirectory: string,
  version: string,
): Promise<string> {
  await fs.mkdir(avatarDirectory, {
    recursive: true,
    mode: 0o755,
  });
  const publicStage = path.join(avatarDirectory, `.staging-${version}`);
  await fs.mkdir(publicStage, {
    mode: 0o700,
  });
  try {
    for (const size of avatarSizes) {
      await fs.copyFile(
        path.join(stageDir, `${size}.jpg`),
        path.join(publicStage, `${size}.jpg`),
      );
      await fs.chmod(path.join(publicStage, `${size}.jpg`), 0o600);
    }
    return publicStage;
  } catch (error) {
    await fs.rm(publicStage, {
      recursive: true,
      force: true,
    });
    throw error;
  }
}
async function processAvatar({
  sourcePath,
  userId,
}: Pick<
  AvatarProcessingJob,
  'sourcePath' | 'userId'
>): Promise<AvatarProcessingResult> {
  const userIdString = userId.toString();
  if (!/^[a-f0-9]{24}$/i.test(userIdString)) {
    throw new Error('Invalid avatar owner id.');
  }
  const version = crypto.randomBytes(16).toString('hex');
  const uploadRoot = path.resolve(config.uploadDir);
  const avatarDirectory = path.join(uploadRoot, userIdString, 'avatar');
  const stageDir = await createPrivateStage();
  const cancellationEmitter = new EventEmitter();
  // The gm wrapper does not detach disposer callbacks after each command.
  // This generation runs one probe, one input identify, and up to three
  // commands per thumbnail (orientation, resize, and output identify), so
  // bound listeners to that known sequential command count.
  cancellationEmitter.setMaxListeners(avatarSizes.length * 3 + 2);
  let publicStage: string | undefined;
  let versionDirectory: string | undefined;
  let timedOut = false;
  const deadline = setTimeout(() => {
    timedOut = true;
    cancellationEmitter.emit('timeout');
  }, uploadProcessingTimeoutMs);
  try {
    if (
      process.env.NODE_ENV === 'test' &&
      process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK === 'true'
    ) {
      await copyTestThumbnails(sourcePath, stageDir);
    } else {
      await createNativeThumbnails(sourcePath, stageDir, cancellationEmitter);
    }
    if (timedOut) {
      throw new Error('Avatar processing exceeded its time limit.');
    }
    await validateThumbnails(stageDir);
    publicStage = await copyToPublicStage(stageDir, avatarDirectory, version);
    if (timedOut) {
      throw new Error('Avatar processing exceeded its time limit.');
    }
    versionDirectory = path.join(avatarDirectory, version);
    await fs.rename(publicStage, versionDirectory);
    publicStage = undefined;

    // Keep the final version inaccessible until every output permission is
    // ready. Making the directory public is the final publication step.
    for (const size of avatarSizes) {
      await fs.chmod(path.join(versionDirectory, `${size}.jpg`), 0o644);
    }
    await fs.chmod(versionDirectory, 0o755);
    if (timedOut) {
      throw new Error('Avatar processing exceeded its time limit.');
    }
    return {
      version,
      versionDirectory,
      avatarDirectory,
    };
  } catch (error) {
    if (publicStage) {
      await fs
        .rm(publicStage, {
          recursive: true,
          force: true,
        })
        .catch(cleanupError => {
          log(
            'error',
            'Avatar processing failed to clean its public staging directory.',
            cleanupError,
          );
        });
    }
    if (versionDirectory) {
      await fs
        .rm(versionDirectory, {
          recursive: true,
          force: true,
        })
        .catch(cleanupError => {
          log(
            'error',
            'Avatar processing failed to clean its unpublished version directory.',
            cleanupError,
          );
        });
    }
    throw error;
  } finally {
    clearTimeout(deadline);
    await fs
      .rm(stageDir, {
        recursive: true,
        force: true,
      })
      .catch(error => {
        log(
          'error',
          'Avatar processing failed to clean its private staging directory.',
          error,
        );
      });
  }
}
async function removeAvatarVersion(
  avatarDirectory: string,
  version: string,
): Promise<void> {
  validateVersion(version);
  await fs.rm(path.join(avatarDirectory, version), {
    recursive: true,
    force: true,
  });
}
const pendingUploads: AvatarProcessingJob[] = [];
let activeUploads = 0;
function processPendingUploads(): void {
  while (activeUploads < 2 && pendingUploads.length) {
    const job = pendingUploads.shift()!;
    activeUploads++;
    processAvatar(job)
      .then(
        result => job.callback(null, result),
        error => job.callback(error),
      )
      .catch(error => {
        log('error', 'Avatar processing callback failed.', error);
      })
      .finally(() => {
        activeUploads--;
        processPendingUploads();
      });
  }
}
function enqueueAvatarProcessing(job: AvatarProcessingJob): boolean {
  if (pendingUploads.length >= maxQueuedUploads) {
    return false;
  }
  pendingUploads.push(job);
  queueMicrotask(processPendingUploads);
  return true;
}
const service: AvatarProcessingService = {
  avatarSizes,
  createLimitedCommand,
  enqueueAvatarProcessing,
  getNativeResourceLimits,
  maxHeight,
  maxPixels,
  maxQueuedUploads,
  maxThumbnailBytes,
  maxWidth,
  processAvatar,
  removeAvatarVersion,
  validateDimensions,
  validateResourceList,
  validateNativeResourceLimits,
  validateVersion,
};
export default service;
export { service as 'module.exports' };

const nativeExportavatarSizes = service.avatarSizes;
export { nativeExportavatarSizes as avatarSizes };

const nativeExportcreateLimitedCommand = service.createLimitedCommand;
export { nativeExportcreateLimitedCommand as createLimitedCommand };

const nativeExportenqueueAvatarProcessing = service.enqueueAvatarProcessing;
export { nativeExportenqueueAvatarProcessing as enqueueAvatarProcessing };

const nativeExportgetNativeResourceLimits = service.getNativeResourceLimits;
export { nativeExportgetNativeResourceLimits as getNativeResourceLimits };

const nativeExportmaxHeight = service.maxHeight;
export { nativeExportmaxHeight as maxHeight };

const nativeExportmaxPixels = service.maxPixels;
export { nativeExportmaxPixels as maxPixels };

const nativeExportmaxQueuedUploads = service.maxQueuedUploads;
export { nativeExportmaxQueuedUploads as maxQueuedUploads };

const nativeExportmaxThumbnailBytes = service.maxThumbnailBytes;
export { nativeExportmaxThumbnailBytes as maxThumbnailBytes };

const nativeExportmaxWidth = service.maxWidth;
export { nativeExportmaxWidth as maxWidth };

const nativeExportprocessAvatar = service.processAvatar;
export { nativeExportprocessAvatar as processAvatar };

const nativeExportremoveAvatarVersion = service.removeAvatarVersion;
export { nativeExportremoveAvatarVersion as removeAvatarVersion };

const nativeExportvalidateDimensions = service.validateDimensions;
export { nativeExportvalidateDimensions as validateDimensions };

const nativeExportvalidateResourceList = service.validateResourceList;
export { nativeExportvalidateResourceList as validateResourceList };

const nativeExportvalidateNativeResourceLimits =
  service.validateNativeResourceLimits;
export { nativeExportvalidateNativeResourceLimits as validateNativeResourceLimits };

const nativeExportvalidateVersion = service.validateVersion;
export { nativeExportvalidateVersion as validateVersion };
