const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const sharp = require('sharp');

const config = require('../../../../config/config');
const errorService = require('../../../core/server/services/error.server.service');

const Tribe = mongoose.model('Tribe');
const imageSizes = [
  [120, 120],
  [742, 496],
  [906, 240],
  [1400, 900],
];
const circleFields =
  '_id slug label count color image public attribution attribution_url description created modified';

function parseBoolean(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  return value === 'true';
}

function circleData(body, existing) {
  return {
    label: body.label,
    color: body.color,
    public: parseBoolean(body.public, existing ? existing.public : true),
    attribution: body.attribution,
    attribution_url: body.attribution_url,
    description: body.description,
  };
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

async function processCircleImage(filePath, slug) {
  const outputFolder = variantsPath(slug);
  await fs.promises.mkdir(outputFolder, { recursive: true });
  const canonicalPath = sourcePath(slug);
  const temporaryCanonicalPath = `${canonicalPath}.tmp-${Date.now()}`;
  await sharp(filePath)
    .rotate()
    .jpeg({ quality: 85 })
    .toFile(temporaryCanonicalPath);
  await fs.promises.rename(temporaryCanonicalPath, canonicalPath);

  await Promise.all(
    imageSizes.flatMap(size =>
      ['jpg', 'webp'].map(async extension => {
        let image = sharp(canonicalPath).resize({
          width: size[0],
          height: size[1],
          fit: 'cover',
        });
        image =
          extension === 'webp'
            ? image.webp({ quality: 72 })
            : image.jpeg({ quality: 72 });
        await image.toFile(
          path.join(outputFolder, `${size.join('x')}.${extension}`),
        );
      }),
    ),
  );
}

async function moveCircleImage(oldSlug, newSlug) {
  if (!oldSlug || oldSlug === newSlug) return;
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

exports.list = async (req, res) => {
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

exports.get = async (req, res) => {
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

exports.create = async (req, res) => {
  let circle;
  try {
    circle = await new Tribe(circleData(req.body)).save();
    if (req.file) {
      await processCircleImage(req.file.path, circle.slug);
      circle.image = true;
      await circle.save();
    }
    return res.status(201).json(circle.toJSON());
  } catch (err) {
    if (req.file?.path) await removeIfExists(req.file.path);
    if (circle?.slug) {
      await removeIfExists(sourcePath(circle.slug));
      await removeIfExists(variantsPath(circle.slug));
      await Tribe.findByIdAndDelete(circle._id).catch(() => {});
    }
    return sendError(res, err);
  } finally {
    if (req.file?.path) await removeIfExists(req.file.path);
  }
};

exports.update = async (req, res) => {
  try {
    const circle = await Tribe.findById(req.params.circle).exec();
    if (!circle) return res.status(404).send({ message: 'Circle not found.' });
    const oldSlug = circle.slug;
    Object.assign(circle, circleData(req.body, circle));
    circle.modified = new Date();
    await circle.save();
    if (circle.image && oldSlug !== circle.slug)
      await moveCircleImage(oldSlug, circle.slug);
    if (req.file) {
      await processCircleImage(req.file.path, circle.slug);
      circle.image = true;
      await circle.save();
    }
    return res.json(circle.toJSON());
  } catch (err) {
    return sendError(res, err);
  } finally {
    if (req.file?.path) await removeIfExists(req.file.path);
  }
};

exports.processImageUpload = (req, res, next) => {
  if (!req.is('multipart/form-data')) return next();
  const fileUpload = require('../../../core/server/services/file-upload.service');
  return fileUpload.uploadFile(
    ['image/gif', 'image/jpeg', 'image/jpg', 'image/png'],
    'image',
    req,
    res,
    next,
  );
};
