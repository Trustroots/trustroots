const async = require('async');
const EventEmitter = require('events');
const fs = require('fs').promises;
const gm = require('gm');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const config = require('../../../../config/config');
const log = require('../../../../config/lib/logger');

const avatarSizes = [2048, 1024, 512, 256, 128, 64, 32];
const maxWidth = 10000;
const maxHeight = 10000;
const maxPixels = 40 * 1000 * 1000;
const maxThumbnailBytes = 8 * 1024 * 1024;
const processorTimeoutMs = 15000;
const uploadProcessingTimeoutMs = 60000;
const maxQueuedUploads = 2;

const imageProcessor =
  config.imageProcessor === 'imagemagic'
    ? gm.subClass({ imageMagick: true })
    : gm;

function getNativeResourceLimits() {
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
    ['file', '16'],
    ['threads', '1'],
    ['read', '40M'],
    ['write', '8M'],
  ];
}

function createLimitedCommand(sourcePath, cancellationEmitter) {
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

function identify(command) {
  return new Promise((resolve, reject) => {
    command.identify({ format: '%w %h\n' }, (error, output) => {
      if (error) {
        return reject(error);
      }
      resolve(output);
    });
  });
}

function validateDimensions(output) {
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

function runNativeCommand(command, method, ...args) {
  return new Promise((resolve, reject) => {
    command[method](...args, error => {
      if (error) {
        return reject(error);
      }
      resolve();
    });
  });
}

function validateVersion(version) {
  if (!/^[a-f0-9]{32}$/.test(version)) {
    throw new Error('Invalid avatar version.');
  }
}

async function createPrivateStage() {
  const configuredTempDir = path.resolve(config.uploadTmpDir || os.tmpdir());
  await fs.mkdir(configuredTempDir, { recursive: true, mode: 0o700 });
  return fs.mkdtemp(path.join(configuredTempDir, 'trustroots-avatar-'));
}

async function copyTestThumbnails(sourcePath, stageDir) {
  if (
    process.env.NODE_ENV !== 'test' ||
    process.env.TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK !== 'true'
  ) {
    throw new Error(
      'The avatar processor fallback is available only in tests.',
    );
  }

  for (const size of avatarSizes) {
    await fs.copyFile(sourcePath, path.join(stageDir, `${size}.jpg`));
  }
}

async function createNativeThumbnails(
  sourcePath,
  stageDir,
  cancellationEmitter,
) {
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

    await runNativeCommand(
      command,
      'write',
      path.join(stageDir, `${size}.jpg`),
    );
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

async function validateThumbnails(stageDir) {
  for (const size of avatarSizes) {
    const thumbnailPath = path.join(stageDir, `${size}.jpg`);
    const stat = await fs.stat(thumbnailPath);
    if (stat.size < 4 || stat.size > maxThumbnailBytes) {
      throw new Error('Generated avatar thumbnail has an invalid file size.');
    }
  }
}

async function copyToPublicStage(stageDir, avatarDirectory, version) {
  await fs.mkdir(avatarDirectory, { recursive: true, mode: 0o755 });
  const publicStage = path.join(avatarDirectory, `.staging-${version}`);
  await fs.mkdir(publicStage, { mode: 0o700 });

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
    await fs.rm(publicStage, { recursive: true, force: true });
    throw error;
  }
}

async function processAvatar({ sourcePath, userId }) {
  const userIdString = userId.toString();
  if (!/^[a-f0-9]{24}$/i.test(userIdString)) {
    throw new Error('Invalid avatar owner id.');
  }

  const version = crypto.randomBytes(16).toString('hex');
  const uploadRoot = path.resolve(config.uploadDir);
  const avatarDirectory = path.join(uploadRoot, userIdString, 'avatar');
  const stageDir = await createPrivateStage();
  const cancellationEmitter = new EventEmitter();
  let publicStage;
  let versionDirectory;
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

    return { version, versionDirectory, avatarDirectory };
  } catch (error) {
    if (publicStage) {
      await fs
        .rm(publicStage, { recursive: true, force: true })
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
        .rm(versionDirectory, { recursive: true, force: true })
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
    await fs.rm(stageDir, { recursive: true, force: true }).catch(error => {
      log(
        'error',
        'Avatar processing failed to clean its private staging directory.',
        error,
      );
    });
  }
}

async function removeAvatarVersion(avatarDirectory, version) {
  validateVersion(version);
  await fs.rm(path.join(avatarDirectory, version), {
    recursive: true,
    force: true,
  });
}

const queue = async.queue((job, done) => {
  processAvatar(job)
    .then(result => job.callback(null, result))
    .catch(error => job.callback(error))
    .finally(done);
}, 2);

function enqueueAvatarProcessing(job) {
  if (queue.length() >= maxQueuedUploads) {
    return false;
  }

  queue.push(job);
  return true;
}

module.exports = {
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
  validateVersion,
};
