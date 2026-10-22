import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import sharp from 'sharp';

import config from '../../../../config/config.mts';
import log from '../../../../config/lib/logger.mjs';
import errorService, {
  type ValidationFailure,
} from '../../../core/server/services/error.server.service.mts';
import fileUpload from '../../../core/server/services/file-upload.service.mts';

import type { TribeRecord } from '../../../tribes/server/models/tribe.server.model.mts';

interface CircleRequest {
  params?: { circle?: string };
  body?: Record<string, unknown>;
  file?: { path?: string };
}
interface CircleResponse {
  status(code: number): CircleResponse;
  send(body: unknown): unknown;
  json(body: unknown): unknown;
}
interface PublicationState {
  canonical: string;
  variants: string;
  canonicalBackup: string;
  variantsBackup: string;
  hadCanonical: boolean;
  hadVariants: boolean;
}
const Tribe = mongoose.model<TribeRecord>('Tribe');
const imageSizes = [
  [120, 120],
  [742, 496],
  [906, 240],
  [1400, 900],
];
const circleFields =
  '_id slug label count color image public attribution attribution_url description created modified';
const descriptionLimit = 4000;
const maxImagePixels = 50_000_000;
const lockWaitMs = 30_000;
const lockStaleMs = 120_000;
const lockRetryMs = 25;

function validationError(field: string, message: string) {
  const error = Object.assign(new Error(message), {
    errors: { [field]: { message } },
  });
  return error;
}

function parseBoolean(value: unknown, fallback: boolean | undefined) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  return value === 'true';
}

function blankToUndefined(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : '';
  // Assigning undefined marks the path for $unset on save.
  return text || undefined;
}

function assertColour(color: unknown): asserts color is string {
  if (typeof color !== 'string' || !/^[0-9a-fA-F]{6}$/.test(color)) {
    throw validationError('color', 'Please choose a valid colour.');
  }
}

function assertDescription(
  description: unknown,
): asserts description is string {
  if (
    typeof description !== 'string' ||
    description.length > descriptionLimit
  ) {
    throw validationError(
      'description',
      'Please keep the description under 4000 characters.',
    );
  }
}

function assertSlug(slug: string | undefined): asserts slug is string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || '')) {
    throw validationError('slug', 'Circle slug is not safe for image storage.');
  }
}

function invalidCircleImageError(err: unknown) {
  return /unsupported image format|corrupt header|premature end of input|exceeds pixel limit|invalid image/i.test(
    String(err),
  );
}

function invalidCircleImage() {
  return validationError(
    'image',
    'Upload a valid JPEG, PNG, or GIF image with no more than 50 million pixels.',
  );
}

function circleData(body: Record<string, unknown>, existing?: TribeRecord) {
  const data: Partial<Omit<TribeRecord, 'label'>> & { label: unknown } = {
    label: body.label,
    public: parseBoolean(body.public, existing ? existing.public : true),
    attribution: blankToUndefined(body.attribution),
    attribution_url: blankToUndefined(body.attribution_url),
  };
  if (body.description !== undefined) {
    assertDescription(body.description);
    data.description = body.description;
  }
  if (body.color !== undefined && body.color !== '') {
    assertColour(body.color);
    data.color = body.color;
  }
  return data;
}

function imageRoot() {
  return path.resolve(config.circleImagesDir);
}

function sourcePath(slug: string) {
  return path.join(imageRoot(), `${slug}.jpg`);
}

function variantsPath(slug: string) {
  return path.join(imageRoot(), slug);
}

function lockPath(slug: string) {
  return path.join(imageRoot(), `.staging-lock-${slug}`);
}

async function removeIfExists(filePath: string) {
  try {
    await fs.promises.rm(filePath, { recursive: true, force: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

async function moveAside(from: string, to: string) {
  try {
    await fs.promises.rename(from, to);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    return false;
  }
}

async function sleep(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function lockAge(file: string) {
  try {
    const stat = await fs.promises.stat(file);
    return Date.now() - stat.mtimeMs;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

async function acquireSlugLock(slug: string) {
  // The lock is the first filesystem operation for an upload. In a fresh
  // checkout or an empty persistent mount, the configured image root may not
  // exist yet, so create it before opening the lock file.
  await fs.promises.mkdir(imageRoot(), { recursive: true });
  const file = lockPath(slug);
  const deadline = Date.now() + lockWaitMs;
  for (;;) {
    try {
      const handle = await fs.promises.open(file, 'wx', 0o600);
      try {
        await handle.writeFile(String(process.pid));
      } finally {
        await handle.close();
      }
      return async () => {
        await removeIfExists(file);
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      const age = await lockAge(file);
      if (age !== null && age > lockStaleMs) {
        await removeIfExists(file);
        continue;
      }
      if (Date.now() >= deadline) {
        throw validationError(
          'image',
          'Another update of this circle image is in progress.',
        );
      }
      await sleep(lockRetryMs);
    }
  }
}

async function restorePrevious(state: PublicationState) {
  await removeIfExists(state.canonical);
  await removeIfExists(state.variants);
  if (state.hadCanonical) {
    await moveAside(state.canonicalBackup, state.canonical);
  }
  if (state.hadVariants) await moveAside(state.variantsBackup, state.variants);
}

async function processCircleImage(filePath: string, slug: string | undefined) {
  assertSlug(slug);
  const inputOptions = {
    animated: false,
    limitInputPixels: maxImagePixels,
  } as const;
  let metadata: import('sharp').Metadata;
  try {
    metadata = await sharp(filePath, inputOptions).metadata();
  } catch (err) {
    if (invalidCircleImageError(err)) throw invalidCircleImage();
    throw err;
  }
  if (
    metadata.width &&
    metadata.height &&
    metadata.width * metadata.height > maxImagePixels
  ) {
    throw invalidCircleImage();
  }
  const staging = path.join(
    imageRoot(),
    `.staging-${slug}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
  );
  const variantsStage = path.join(staging, 'variants');
  const state = {
    canonical: sourcePath(slug),
    variants: variantsPath(slug),
    canonicalBackup: path.join(staging, 'previous-canonical.jpg'),
    variantsBackup: path.join(staging, 'previous-variants'),
    hadCanonical: false,
    hadVariants: false,
  };
  let swapped = false;
  try {
    await fs.promises.mkdir(variantsStage, { recursive: true, mode: 0o700 });
    const canonicalStage = path.join(staging, 'canonical.jpg');
    try {
      await sharp(filePath, inputOptions)
        .rotate()
        .jpeg({ quality: 85 })
        .toFile(canonicalStage);
    } catch (err) {
      if (invalidCircleImageError(err)) throw invalidCircleImage();
      throw err;
    }
    await Promise.all(
      imageSizes.flatMap(size =>
        ['jpg', 'webp'].map(async extension => {
          let image = sharp(canonicalStage).resize({
            width: size[0],
            height: size[1],
            fit: 'cover',
          });
          image =
            extension === 'webp'
              ? image.webp({ quality: 72 })
              : image.jpeg({ quality: 72 });
          await image.toFile(
            path.join(variantsStage, `${size.join('x')}.${extension}`),
          );
        }),
      ),
    );
    // The staging parent remains private; published variants must be traversable
    // by the web server, which runs as a different user from the application.
    await fs.promises.chmod(variantsStage, 0o755);
    state.hadCanonical = await moveAside(
      state.canonical,
      state.canonicalBackup,
    );
    state.hadVariants = await moveAside(state.variants, state.variantsBackup);
    swapped = true;
    await fs.promises.rename(canonicalStage, state.canonical);
    await fs.promises.rename(variantsStage, state.variants);
    return {
      async commit() {
        await removeIfExists(staging);
      },
      async rollback() {
        await restorePrevious(state);
        await removeIfExists(staging);
      },
    };
  } catch (err) {
    if (swapped) await restorePrevious(state);
    else if (state.hadCanonical) {
      await moveAside(state.canonicalBackup, state.canonical);
    }
    await removeIfExists(staging);
    throw err;
  }
}

function sendError(res: CircleResponse, err: unknown) {
  if (!(err && typeof err === 'object' && 'errors' in err)) {
    log('error', 'Failed to process circle administration request.', {
      error: err,
    });
  }
  return res
    .status(400)
    .send({ message: errorService.getErrorMessage(err as ValidationFailure) });
}

async function saveCircle(
  circle: mongoose.HydratedDocument<TribeRecord>,
  filePath?: string,
) {
  let release = async () => {};
  if (filePath) {
    assertSlug(circle.slug);
    release = await acquireSlugLock(circle.slug);
  }
  let publication: Awaited<ReturnType<typeof processCircleImage>> | undefined;
  let saved = false;
  try {
    if (filePath) {
      publication = await processCircleImage(filePath, circle.slug);
      circle.image = true;
    }
    // create/update already validated this document. Revalidation can regenerate
    // a new circle's slug after images have been published under the locked slug.
    // Let the unique index reject a concurrent collision and roll the files back.
    await circle.save({ validateBeforeSave: false });
    saved = true;
    if (publication) await publication.commit();
    return circle;
  } catch (err) {
    if (publication && !saved) await publication.rollback();
    throw err;
  } finally {
    await release();
  }
}

export const list = async (req: CircleRequest, res: CircleResponse) => {
  try {
    const circles = await Tribe.find()
      .select(circleFields)
      .sort({ label: 1 })
      .exec();
    return res.json(circles);
  } catch (err) {
    return sendError(res, err);
  }
};

export const get = async (req: CircleRequest, res: CircleResponse) => {
  try {
    const circle = await Tribe.findById(req.params!.circle)
      .select(circleFields)
      .exec();
    if (!circle) return res.status(404).send({ message: 'Circle not found.' });
    return res.json(circle);
  } catch (err) {
    return sendError(res, err);
  }
};

export const create = async (req: CircleRequest, res: CircleResponse) => {
  let circle;
  try {
    circle = new Tribe(circleData(req.body!));
    circle.modified = new Date();
    await circle.validate();
    await saveCircle(circle, req.file?.path);
    return res.status(201).json(circle.toJSON());
  } catch (err) {
    return sendError(res, err);
  } finally {
    if (req.file?.path) await removeIfExists(req.file.path);
  }
};

export const update = async (req: CircleRequest, res: CircleResponse) => {
  try {
    const circle = await Tribe.findById(req.params!.circle).exec();
    if (!circle) return res.status(404).send({ message: 'Circle not found.' });
    Object.assign(circle, circleData(req.body!, circle));
    circle.modified = new Date();
    await circle.validate();
    await saveCircle(circle, req.file?.path);
    return res.json(circle.toJSON());
  } catch (err) {
    return sendError(res, err);
  } finally {
    if (req.file?.path) await removeIfExists(req.file.path);
  }
};

export const processImageUpload = (
  req: CircleRequest & { is(type: string): unknown },
  res: CircleResponse,
  next: () => void,
) => {
  if (!req.is('multipart/form-data')) return next();
  return fileUpload.uploadFile(
    ['image/gif', 'image/jpeg', 'image/jpg', 'image/png'],
    'image',
    req,
    res,
    next,
  );
};

const service = { list, get, create, update, processImageUpload };
export default service;
export { service as 'module.exports' };
