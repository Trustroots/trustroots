#!/usr/bin/env node
/**
 * Generate different image sizes for circle images
 *
 * Uses Sharp to manipulate image: https://sharp.pixelplumbing.com/
 *
 * Production images are kept at `public/uploads-circle`.
 */
import config from './../config/config.mts';
import fs from 'fs';
import { globSync } from 'node:fs';
import path from 'path';
import sharp from 'sharp';
interface ImageTask {
  extension: 'webp' | 'jpg';
  file: string;
  outputFolder: string;
  size: [number, number];
  slug: string;
}

(async () => {
  sharp.simd(false);

  // Width and height in pixels
  const circleImagesSizes: Array<[number, number]> = [
    [120, 120],
    [742, 496],
    [906, 240],
    [1400, 900],
  ];
  const extensions: ImageTask['extension'][] = ['webp', 'jpg'];
  const circleImagesDir = config.circleImagesDir as string;
  const dir = path.resolve(circleImagesDir);
  const files = globSync(path.join(dir, '*.jpg'));
  if (files.length === 0) {
    console.warn(`No circle images found from ${dir}!`);
    return;
  }
  console.log(
    `Ensuring ${files.length} circle images have all sizes and formats generated...`,
  );

  // Create a task queue that processes a few images at most at a time
  async function processImage(task: ImageTask): Promise<void> {
    const { extension, file, outputFolder, size, slug } = task;
    const sizeSlug = size.join('x');
    const targetFile = path.join(outputFolder, `${sizeSlug}.${extension}`);

    // File exists, all good
    if (fs.existsSync(targetFile)) {
      return;
    }
    let image = await sharp(file);
    image = await image.resize({
      width: size[0],
      height: size[1],
      fit: 'cover',
    });
    if (extension === 'webp') {
      image = await image.webp({
        quality: 72,
      });
    } else {
      image = await image.jpeg({
        quality: 72,
      });
    }
    await image.toFile(targetFile);
    const output = [
      '✓',
      size.join(' x ').padStart(11, ' '),
      extension.padStart(4, ' '),
      slug,
    ];
    console.log(output.join('\t'));
  }
  const tasks: ImageTask[] = [];

  // Loop files and process them
  files.forEach(file => {
    const slug = path.basename(file, '.jpg');
    const outputFolder = path.join(path.resolve(circleImagesDir), slug);

    // Ensure folder exists
    fs.mkdirSync(outputFolder, {
      recursive: true,
    });

    // Loop sizes and fileformats
    circleImagesSizes.forEach(size => {
      extensions.forEach(extension => {
        tasks.push({
          extension,
          file,
          outputFolder,
          size,
          slug,
        });
      });
    });
  });
  let nextTask = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (nextTask < tasks.length) {
        const task = tasks[nextTask++];
        try {
          await processImage(task);
        } catch {
          // As with the former queue, a failed image does not stop other tasks.
        }
      }
    }),
  );
})();
