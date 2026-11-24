import dependency2 from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import config from './../../../../config/config.mts';
import log from '@trustroots/logger';
import processAvatarImage from './avatar-processing.server.worker.mts';
import {
  avatarSizes,
  maxHeight,
  maxPixels,
  maxWidth,
  validateDimensions,
} from './avatar-processing.server.dimensions.mts';
import type {
  AvatarProcessingJob,
  AvatarProcessingResult,
  AvatarProcessingService,
} from './avatar-processing.server.types.mts';
const fs = dependency2.promises;
const maxThumbnailBytes = 8 * 1024 * 1024;
const uploadProcessingTimeoutMs = 60000;
const maxQueuedUploads = 2;
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
  const processing = new AbortController();
  const deadline = setTimeout(() => {
    processing.abort(timeLimitError());
  }, uploadProcessingTimeoutMs);
  try {
    if (
      process.env.NODE_ENV === 'test' &&
      process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK === 'true'
    ) {
      await copyTestThumbnails(sourcePath, stageDir);
    } else {
      await processAvatarImage(sourcePath, stageDir, processing.signal);
    }
    processing.signal.throwIfAborted();
    await validateThumbnails(stageDir);
    publicStage = await copyToPublicStage(stageDir, avatarDirectory, version);
    processing.signal.throwIfAborted();
    versionDirectory = path.join(avatarDirectory, version);
    await fs.rename(publicStage, versionDirectory);
    publicStage = undefined;

    // Keep the final version inaccessible until every output permission is
    // ready. Making the directory public is the final publication step.
    for (const size of avatarSizes) {
      await fs.chmod(path.join(versionDirectory, `${size}.jpg`), 0o644);
    }
    await fs.chmod(versionDirectory, 0o755);
    processing.signal.throwIfAborted();
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
