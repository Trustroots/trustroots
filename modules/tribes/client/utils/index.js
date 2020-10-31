import { canUseWebP } from '@/modules/core/client/utils/dom';

/**
 * Return Circle background image URL
 *
 * Usage: getCircleBackgroundUrl(circle, '742x496', 'jpg')
 *
 * @param {string} slug - the circle slug
 * @param {string} dimensions - Set background image dimensions (width x height)
 * @param {string} [format=jpg] - File format, either "jpg" or "webp"
 *
 * @returns {string}
 */
export function getCircleBackgroundUrl(slug, dimensions, format = 'jpg') {
  return `/uploads-circle/${slug}/${dimensions}.${format}`;
}

/**
 * Generate background color + image styles for Circle panel.
 * Returns image either in jpg or webp format depending on browser support.
 *
 * usage in React: <div style={getCircleBackgroundStyle(circle, '742x496')}>...</div>
 *
 * @param {object} circle - the circle data
 * @param {string} dimensions - Set background image dimensions (width x height)
 *
 * @returns {object}
 */
export function getCircleBackgroundStyle(circle, dimensions) {
  const style = {};
  const { color, image, slug } = circle;
  const format = canUseWebP() ? 'webp' : 'jpg';

  // Set background image
  if (image) {
    const url = getCircleBackgroundUrl(slug, dimensions, format);
    style.backgroundImage = `url(${url})`;
  }

  // Set background color
  if (color) {
    style.backgroundColor = `#${color}`;
  }

  return style;
}
