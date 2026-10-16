import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import sharp from 'sharp';

import config from '../../../../config/config.mts';
import errorService from '../../../core/server/services/error.server.service.mts';
import fileUpload from '../../../core/server/services/file-upload.service.mts';

const Tribe = mongoose.model('Tribe');
const imageSizes = [
  [120, 120],
  [742, 496],
  [906, 240],
  [1400, 900],
];
const circleFields =
  '_id slug label count color image public attribution attribution_url description created modified';

function validationError(field, message) {
  const error = new Error(message);
  error.errors = { [field]: { message } };
  return error;
}

function parseBoolean(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  return value === 'true';
}

function blankToUndefined(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  // Assigning undefined marks the path for $unset on save.
  return text || undefined;
}

function assertColour(color) {
  if (typeof color !== 'string' || !/^[0-9a-fA-F]{6}$/.test(color)) {
    throw validationError('color', 'Please choose a valid colour.');
  }
}

function assertSlug(slug) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || '')) {
    throw validationError('slug', 'Circle slug is not safe for image storage.');
  }
}

function circleData(body, existing) {
  const data = {
    label: body.label,
    public: parseBoolean(body.public, existing ? existing.public : true),
    attribution: blankToUndefined(body.attribution),
    attribution_url: blankToUndefined(body.attribution_url),
  };
  if (body.description !== undefined) data.description = body.description;
  if (body.color !== undefined && body.color !== '') {
    assertColour(body.color);
    data.color = body.color;
  }
  return data;
}

function imageRoot() {
  return path.resolve(config.circleImagesDir);
}

function sourcePath(slug) {
  return path.join(imageRoot(), `${slug}.jpg`);
}

function variantsPath(slug) {
  return path.join(imageRoot(), slug);
}

async function removeIfExists(filePath) {
  try {
    await fs.promises.rm(filePath, { recursive: true, force: true });
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

async function moveAside(from, to) {
  try {
    await fs.promises.rename(from, to);
    return true;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return false;
  }
}

async function restorePrevious(state) {
  await removeIfExists(state.canonical);
  await removeIfExists(state.variants);
  if (state.hadCanonical) {
    await moveAside(state.canonicalBackup, state.canonical);
  }
  if (state.hadVariants) await moveAside(state.variantsBackup, state.variants);
}

async function processCircleImage(filePath, slug) {
  assertSlug(slug);
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
    await sharp(filePath).rotate().jpeg({ quality: 85 }).toFile(canonicalStage);
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

async function moveCircleImage(oldSlug, newSlug) {
  if (!oldSlug || oldSlug === newSlug) return;
  assertSlug(oldSlug);
  assertSlug(newSlug);
  try {
    await fs.promises.rename(sourcePath(oldSlug), sourcePath(newSlug));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  try {
    await fs.promises.rename(variantsPath(oldSlug), variantsPath(newSlug));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

function sendError(res, err) {
  return res.status(400).send({ message: errorService.getErrorMessage(err) });
}

async function saveCircle(circle, filePath, oldSlug) {
  let publication;
  let saved = false;
  if (filePath) {
    assertSlug(circle.slug);
    publication = await processCircleImage(filePath, circle.slug);
    circle.image = true;
  }
  try {
    await circle.save();
    saved = true;
    if (publication) await publication.commit();
    if (circle.image && oldSlug && oldSlug !== circle.slug) {
      await moveCircleImage(oldSlug, circle.slug);
    }
    return circle;
  } catch (err) {
    if (publication && !saved) await publication.rollback();
    throw err;
  }
}

export const list = async (req, res) => {
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

export const get = async (req, res) => {
  try {
    const circle = await Tribe.findById(req.params.circle)
      .select(circleFields)
      .exec();
    if (!circle) return res.status(404).send({ message: 'Circle not found.' });
    return res.json(circle);
  } catch (err) {
    return sendError(res, err);
  }
};

export const create = async (req, res) => {
  let circle;
  try {
    circle = new Tribe(circleData(req.body));
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

export const update = async (req, res) => {
  try {
    const circle = await Tribe.findById(req.params.circle).exec();
    if (!circle) return res.status(404).send({ message: 'Circle not found.' });
    const oldSlug = circle.slug;
    Object.assign(circle, circleData(req.body, circle));
    circle.modified = new Date();
    await circle.validate();
    await saveCircle(circle, req.file?.path, oldSlug);
    return res.json(circle.toJSON());
  } catch (err) {
    return sendError(res, err);
  } finally {
    if (req.file?.path) await removeIfExists(req.file.path);
  }
};

export const processImageUpload = (req, res, next) => {
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
