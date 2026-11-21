import type { Metadata } from 'sharp';

export const avatarSizes = [2048, 1024, 512, 256, 128, 64, 32];
export const maxWidth = 10000;
export const maxHeight = 10000;
export const maxPixels = 40 * 1000 * 1000;
const supportedFormats = ['gif', 'jpeg', 'png'];

export function validateDimensions({
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
