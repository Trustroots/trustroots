import dependency2 from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import sharp, { type Metadata, type Sharp } from 'sharp';
import config from './../../../../config/config.mts';
import log from './../../../../config/lib/logger.mjs';
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
const processorTimeoutSeconds = 15;
const uploadProcessingTimeoutMs = 60000;
const maxQueuedUploads = 2;
const supportedFormats = ['gif', 'jpeg', 'png'];
sharp.concurrency(1);
function openLimitedImage(sourcePath: string): Sharp {
  return sharp(sourcePath, {
    failOn: 'warning',
    limitInputPixels: maxPixels,
  }).timeout({ seconds: processorTimeoutSeconds });
}
function validateDimensions({
  format,
  height,
  pages,
  width,
}: Pick<Metadata, 'format' | 'height' | 'pages' | 'width'>): void {
  if (!supportedFormats.includes(format)) {
    throw new Error('Unsupported image format.');
  }
  if ((pages ?? 1) !== 1) {
    throw new Error('Only single-frame images are supported.');
  }
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
function validateVersion(version: string): void {
  if (!/^[a-f0-9]{32}$/.test(version)) {
    throw new Error('Invalid avatar version.');
  }
}
function timeLimitError(): Error {
  return new Error('Avatar processing exceeded its time limit.');
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
  timedOut: () => boolean,
) {
  validateDimensions(await openLimitedImage(sourcePath).metadata());
  for (const size of avatarSizes) {
    if (timedOut()) {
      throw timeLimitError();
    }
    const output = await openLimitedImage(sourcePath)
      .autoOrient()
      .flatten({ background: '#ffffff' })
      .resize(size, size, { fit: 'cover', kernel: 'linear' })
      .sharpen({ sigma: 0.25 })
      .toColourspace('srgb')
      .jpeg({ quality: 82 })
      .toFile(path.join(stageDir, `${size}.jpg`));
    if (output.width !== size || output.height !== size) {
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
      // Stryker disable next-line BooleanLiteral: this call just created publicStage, so it exists and force never applies
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
  let publicStage: string | undefined;
  let versionDirectory: string | undefined;
  let timedOut = false;
  const deadline = setTimeout(() => {
    timedOut = true;
  }, uploadProcessingTimeoutMs);
  try {
    if (
      process.env.NODE_ENV === 'test' &&
      process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK === 'true'
    ) {
      await copyTestThumbnails(sourcePath, stageDir);
    } else {
      await createNativeThumbnails(sourcePath, stageDir, () => timedOut);
    }
    if (timedOut) {
      throw timeLimitError();
    }
    await validateThumbnails(stageDir);
    publicStage = await copyToPublicStage(stageDir, avatarDirectory, version);
    if (timedOut) {
      throw timeLimitError();
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
      throw timeLimitError();
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
          // Stryker disable next-line BooleanLiteral: publicStage is cleared once renamed, so it still exists here and force never applies
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
        // Stryker disable next-line BooleanLiteral: mkdtemp created stageDir for this upload alone, so it exists and force never applies
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
  enqueueAvatarProcessing,
  maxHeight,
  maxPixels,
  maxQueuedUploads,
  maxThumbnailBytes,
  maxWidth,
  processAvatar,
  removeAvatarVersion,
  validateDimensions,
  validateVersion,
};
export default service;

const nativeExportavatarSizes = service.avatarSizes;
export { nativeExportavatarSizes as avatarSizes };

const nativeExportenqueueAvatarProcessing = service.enqueueAvatarProcessing;
export { nativeExportenqueueAvatarProcessing as enqueueAvatarProcessing };

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

const nativeExportvalidateVersion = service.validateVersion;
export { nativeExportvalidateVersion as validateVersion };
