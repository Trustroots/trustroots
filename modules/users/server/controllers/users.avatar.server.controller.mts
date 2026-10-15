import fs from 'fs';
import mongoose from 'mongoose';
import log from './../../../../config/lib/logger.mjs';
import config from './../../../../config/config.mts';
import fileUpload from './../../../core/server/services/file-upload.service.mjs';
import errorService from './../../../core/server/services/error.server.service.mjs';
import avatarProcessor from './../services/avatar-processing.server.service.mts';
import type {
  AvatarNext,
  AvatarRequest,
  AvatarResponse,
  AuthenticatedAvatarRequest,
  AvatarUploadRequest,
  UsersAvatarController,
} from './users.avatar.server.contracts.mts';
import type {
  UserServerDocument,
  UserServerModel,
  UserServerRecord,
} from '../models/user.server.types.mts';
import type {
  AvatarProcessingJob,
  AvatarProcessingResult,
} from '../services/avatar-processing.server.types.mts';
const service = {} as UsersAvatarController;
const User = mongoose.model<UserServerRecord, UserServerModel>('User');
const avatarVersionPattern = /^[a-f0-9]{32}$/;

/**
 * Middleware to validate+process avatar upload field
 */
const avatarUploadField = (
  req: AvatarRequest,
  res: AvatarResponse,
  next: AvatarNext,
) => {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }
  const validImageMimeTypes = [
    'image/gif',
    'image/jpeg',
    'image/jpg',
    'image/png',
  ];
  fileUpload.uploadFile(
    validImageMimeTypes,
    'avatar',
    req,
    res,
    next,
    config.maxAvatarUploadSize,
  );
};

/**
 * Upload user avatar
 *
 * Handles results from avatarUploadField and `uploadFile` service.
 * Multer has placed uploaded the file in temp folder and path is now available
 * via `req.file.path`
 */
const removeTemporaryUpload = async (sourcePath: string): Promise<void> => {
  try {
    await fs.promises.unlink(sourcePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      log(
        'error',
        'User profile avatar upload: failed to clean out temporary image.',
        error as Record<string, unknown>,
      );
    }
  }
};
const removeVersionAfterSaveFailure = async (
  result: AvatarProcessingResult,
): Promise<void> => {
  try {
    await avatarProcessor.removeAvatarVersion(
      result.avatarDirectory,
      result.version,
    );
  } catch (error: unknown) {
    log(
      'error',
      'User profile avatar upload: failed to clean up unpublished avatar version.',
      error as Record<string, unknown>,
    );
  }
};
const avatarUpload = (req: AvatarUploadRequest, res: AvatarResponse): void => {
  const job: AvatarProcessingJob = {
    sourcePath: req.file.path,
    userId: req.user._id,
    callback: async (processingError, result) => {
      if (processingError) {
        await removeTemporaryUpload(req.file.path);
        log(
          'error',
          'User profile avatar upload: failed to generate thumbnails.',
          processingError as unknown as Record<string, unknown>,
        );
        return res.status(422).send({
          message: 'Failed to process image, please try again.',
        });
      }
      const processedAvatar = result!;
      const previousVersion = req.user.avatarVersion;
      req.user.avatarVersion = processedAvatar.version;
      try {
        await req.user.save();
      } catch (error) {
        req.user.avatarVersion = previousVersion;
        await Promise.all([
          removeTemporaryUpload(req.file.path),
          removeVersionAfterSaveFailure(processedAvatar),
        ]);
        return res.status(400).send({
          message:
            errorService.getErrorMessage(error as Error) ||
            'Failed to save the new avatar version.',
        });
      }
      await removeTemporaryUpload(req.file.path);
      try {
        const currentUser = await User.findById(
          req.user._id,
          'avatarVersion',
        ).exec();
        if (currentUser?.avatarVersion === processedAvatar.version) {
          if (
            previousVersion &&
            avatarVersionPattern.test(previousVersion) &&
            previousVersion !== processedAvatar.version
          ) {
            try {
              await avatarProcessor.removeAvatarVersion(
                processedAvatar.avatarDirectory,
                previousVersion,
              );
            } catch (cleanupError: unknown) {
              log(
                'error',
                'User profile avatar upload: failed to remove the previous avatar version.',
                cleanupError as unknown as Record<string, unknown>,
              );
            }
          }
        }
      } catch (findError: unknown) {
        log(
          'error',
          'User profile avatar upload: failed to verify current avatar version.',
          findError as unknown as Record<string, unknown>,
        );
      }
      return res.send({
        message: 'Avatar image uploaded.',
      });
    },
  };
  if (!avatarProcessor.enqueueAvatarProcessing(job)) {
    removeTemporaryUpload(req.file.path).finally(() => {
      res.status(503).send({
        message: 'Avatar processing is busy. Please try again shortly.',
      });
    });
  }
};

/**
 * Generate url to avatar image that user uploaded
 * @param {object} user - user object
 * @param {number} size - size of the image
 * @returns {string} - the url
 */
function getLocalAvatarUrl(
  user: UserServerRecord | UserServerDocument | null | undefined,
  size: number,
): string | undefined {
  const isValid = user && user.avatarUploaded && user._id;
  if (isValid) {
    // Cache buster
    const timestamp = user.updated ? new Date(user.updated).getTime() : '';

    // 32 is the smallest and 2048 biggest file size we're generating.
    const fileSize = Math.min(Math.max(size, 32), 2048);
    const domain = `${config.https ? 'https' : 'http'}://${config.domain}`;
    const version = avatarVersionPattern.test(user.avatarVersion || '')
      ? `${user.avatarVersion}/`
      : '';
    return `${domain}/uploads-profile/${user._id}/avatar/${version}${fileSize}.jpg?${timestamp}`;
  }
}

/**
 * Generate avatar url from Gravatar
 * @link https://en.gravatar.com/site/implement/images/
 * @param {object} user - user object
 * @param {string} user.emailHash - gravatar identifies users by their email hashes
 * @param {number} size - size of the image
 * @returns {string} - the url
 *
 * @todo fallback image is provided from trustroots.org; it should rather come from config
 */
function getGravatarUrl(
  user: Pick<UserServerRecord, 'emailHash'>,
  size: number,
): string | false | undefined {
  const isValid = user.emailHash;

  // This fallback image has to be online one and not from localhost, since Gravatar needs to see it.
  const fallbackImage = getDefaultAvatarUrl(size, false);
  return (
    isValid &&
    `https://gravatar.com/avatar/${
      user.emailHash
    }?s=${size}&d=${encodeURIComponent(fallbackImage)}`
  );
}

/**
 * Generate avatar url
 * @param {object} user - user object
 * @param {integer} size - size of the image. Supported values are 2048, 1024, 512, 256, 128, 64, 36, 32, 24, 16.
 * @param {string} source - avatar source. One of ['' (user's selected source), 'none', 'gravatar', 'local']
 * @returns {string} - the url
 */
function getAvatarUrl(
  profile: UserServerRecord | UserServerDocument,
  size: number,
  source: string | undefined,
): string {
  return (
    (source === 'local' && getLocalAvatarUrl(profile, size)) ||
    (source === 'gravatar' && getGravatarUrl(profile, size)) ||
    getDefaultAvatarUrl(size)
  );
}
function getDefaultAvatarUrl(size: number, local = true): string {
  // Callers always pass a size; guard defensively so a missing size can never
  // produce an `avatar-undefined.png` URL.
  /* istanbul ignore next */
  const resolvedSize = size || 1024;
  const domain = local
    ? `${config.https ? 'https' : 'http'}://${config.domain}`
    : 'https://trustroots.org';
  return `${domain}/img/avatar-${resolvedSize}.png`;
}

/**
 * Serve avatar URL via redirect
 *
 * @TODO: serve by streaming instead of redirect and add caching layer.
 *
 * @param  {Object} res
 * @param  {String} url
 */
function serveAvatarUrl(res: AvatarResponse, url: string): void {
  res
    .status(302) // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/302
    // .setHeader('Cache-Control', 'public, max-age=0')
    .redirect(url);
}

/**
 * Return avatar file URL
 */
const getAvatar = (
  req: AuthenticatedAvatarRequest,
  res: AvatarResponse,
): unknown => {
  const validSizes = [2048, 1024, 512, 256, 128, 64, 36, 32, 24, 16];
  const defaultSize = 1024;
  if (req.query.size && !validSizes.includes(parseInt(req.query.size, 10))) {
    return res.status(400).send({
      message: `Invalid size. Please use one of these: ${validSizes.join(
        ', ',
      )}`,
    });
  }
  const size = parseInt(req.query.size || '', 10) || defaultSize;
  const defaultAvatarUrl = getDefaultAvatarUrl(size);
  if (!req.profile) {
    return serveAvatarUrl(res, defaultAvatarUrl);
  }
  const isOwnProfile = req.user._id.equals(req.profile._id);
  const isBannedProfile =
    req.profile.roles.includes('suspended') ||
    req.profile.roles.includes('shadowban');
  const isBlockedByProfile = (req.profile.blocked || []).some(
    blockedUserId => blockedUserId.toString() === req.user._id.toString(),
  );
  const isPublicProfile = req.profile.public;
  const isAdmin = req.user.roles.includes('admin');
  if (
    !isAdmin &&
    !isOwnProfile &&
    (!isPublicProfile || isBannedProfile || isBlockedByProfile)
  ) {
    return serveAvatarUrl(res, defaultAvatarUrl);
  }
  let source: string | undefined = req.profile.avatarSource;

  // Only authenticated user can define custom source
  if (req.query.source && isOwnProfile) {
    const validSources = (
      User.schema.path('avatarSource') as unknown as { enumValues: string[] }
    ).enumValues;
    if (!validSources.includes(req.query.source)) {
      return res.status(400).send({
        message: `Invalid source. Please use one of these: ${validSources.join(
          ', ',
        )}`,
      });
    }
    source = req.query.source;
  }
  const avatarUrl = getAvatarUrl(req.profile, size, source);
  serveAvatarUrl(res, avatarUrl);
};

/**
 * Middleware to find user for avatar
 */
const userForAvatarByUserId = async (
  req: AvatarRequest,
  res: AvatarResponse,
  next: AvatarNext,
  userId: string,
): Promise<unknown> => {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }
  const fields = [
    'avatarSource',
    'avatarUploaded',
    'avatarVersion',
    'blocked',
    'emailHash',
    // MD5 hashed email to use with Gravatars
    'id',
    'public',
    'roles',
    'updated',
  ].join(' ');

  // We could limit search here to only public and non-suspended users, but that's more complex and slower query.
  req.profile = await User.findById(userId, fields);
  next();
};
Object.assign(service, {
  avatarUpload,
  avatarUploadField,
  getAvatar,
  userForAvatarByUserId,
});
export default service;
export { service as 'module.exports' };
const nativeExportavatarUpload = service.avatarUpload;
export { nativeExportavatarUpload as avatarUpload };

const nativeExportavatarUploadField = service.avatarUploadField;
export { nativeExportavatarUploadField as avatarUploadField };

const nativeExportgetAvatar = service.getAvatar;
export { nativeExportgetAvatar as getAvatar };

const nativeExportuserForAvatarByUserId = service.userForAvatarByUserId;
export { nativeExportuserForAvatarByUserId as userForAvatarByUserId };
