#!/usr/bin/env node
/**
 * Generate different image sizes for circle images
 *
 * Uses Sharp to manipulate image: https://sharp.pixelplumbing.com/
 *
 * Production images are kept at https://github.com/Trustroots/circle-images
 */

const async = require('async');
const config = require('../config/config');
const fs = require('fs');
const glob = require('glob');
const mkdir = require('mkdir-recursive');
const path = require('path');
const sharp = require('sharp');

// Width and height in pixels
const circleImagesSizes = [
  [120, 120],
  [742, 496],
  [906, 240],
  [1400, 900],
];

const dir = path.resolve(config.circleImagesDir);
const files = glob.sync(path.join(dir, '**.jpg'));

if (files.length === 0) {
  console.warn(`No circle images found from ${dir}!`);
  return;
}

console.log(
  `Ensuring ${files.length} circle images have all sizes and formats generated...`,
);

// Create a task queue that processes a few images at most at a time
const queue = async.queue(async (task, callback) => {
  const { extension, file, outputFolder, size, slug } = task;
  const sizeSlug = size.join('x');
  const targetFile = path.join(outputFolder, `${sizeSlug}.${extension}`);

  // File exists, all good
  if (fs.existsSync(targetFile)) {
    return callback();
  }

  let image = await sharp(file);
  image = await image.resize({
    width: size[0],
    height: size[1],
    fit: 'cover',
  });

  if (extension === 'webp') {
    image = await image.webp({ quality: 72 });
  } else {
    image = await image.jpeg({ quality: 72 });
  }

  await image.toFile(targetFile);

  const output = [
    '✓',
    size.join(' x ').padStart(11, ' '),
    extension.padStart(4, ' '),
    slug,
  ];

  console.log(output.join('\t'));

  callback();
}, 4);

// Loop files and process them
files.forEach(file => {
  const slug = path.basename(file, '.jpg');
  const outputFolder = path.join(path.resolve(config.circleImagesDir), slug);

  // Ensure folder exists
  mkdir.mkdirSync(outputFolder);

  // Loop sizes and fileformats
  circleImagesSizes.forEach(size => {
    ['webp', 'jpg'].forEach(async extension => {
      queue.push({
        extension,
        file,
        outputFolder,
        size,
        slug,
      });
    });
  });
});
