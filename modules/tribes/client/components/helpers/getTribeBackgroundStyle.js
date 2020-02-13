/**
 * Generate background color + image styles for tribe panel
 *
 * usage in React: <div style={getTribeBackgroundStyle(tribe, { quality: 'normal', dimensions: '742x496', isProgressive: true })}>...</div>
 *
 * @param {object} tribe - the tribe data
 *
 * @param {string} [dimensions=1024x768] - Set background image dimensions (width x height)
 *   See https://uploadcare.com/documentation/cdn/#operation-scale-crop
 *
 * @param {string} [quality=lighter] - Set background image quality
 *   Options: normal, better, best, lighter (default), lightest
 *   See https://uploadcare.com/documentation/cdn/#operation-quality
 *
 * @param {boolean} [isProgressive=false] - Set progressive image loading
 *   See https://uploadcare.com/documentation/cdn/#operation-progressive
 *
 * @returns {object}
 */
export default function getTribeBackgroundStyle(
  tribe,
  { quality = 'lighter', dimensions = '1024x768', isProgressive = false } = {},
) {
  const style = {};

  // Set background image
  // Uses Uploadcare.com to resize and deliver images
  if (tribe.image_UUID) {
    const progressive = isProgressive ? 'yes' : 'no';

    const imgParams = [
      `progressive/${progressive}`,
      `scale_crop/${dimensions}/center`,
      `quality/${quality}`,
      'format/jpeg',
    ];

    const imageUrl = `https://ucarecdn.com/${
      tribe.image_UUID
    }/-/${imgParams.join('/-/')}/`;
    style.backgroundImage = `url(${imageUrl})`;
  }

  if (tribe.color) {
    style.backgroundColor = `#${tribe.color}`;
  }

  return style;
}
