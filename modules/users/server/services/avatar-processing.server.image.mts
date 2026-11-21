import path from 'node:path';
import sharp from 'sharp';
import {
  avatarSizes,
  maxPixels,
  validateDimensions,
} from './avatar-processing.server.dimensions.mts';

sharp.concurrency(1);

function openLimitedImage(sourcePath: string) {
  return sharp(sourcePath, {
    failOn: 'warning',
    limitInputPixels: maxPixels,
  }).timeout({ seconds: 15 });
}

export async function createNativeThumbnails(
  sourcePath: string,
  stageDir: string,
) {
  validateDimensions(await openLimitedImage(sourcePath).metadata());
  for (const size of avatarSizes) {
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
