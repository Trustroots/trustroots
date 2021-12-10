/**
 * Calculate how many meters one pixel of a map contains, based on zoom and latitude level
 * @link https://stackoverflow.com/a/30773300
 * @link https://wiki.openstreetmap.org/wiki/Zoom_levels
 *
 * @param  {[float]} latitude
 * @param  {[number]} zoom
 * @return {[number]}
 */
const metersPerPixel = ({ latitude, zoom }) => {
  const earthCircumference = 40075017;
  const latitudeRadians = latitude * (Math.PI / 180);
  return (
    (earthCircumference * Math.cos(latitudeRadians)) / Math.pow(2, zoom + 8)
  );
};

/**
 * Turn latitude, meters, and zoom level into a value that can be used as radius for SVG circle element on a Map.
 * @link https://stackoverflow.com/a/30773300
 *
 * @param  {[float]} latitude
 * @param  {[number]} meters
 * @param  {[number]} zoom
 * @return {[number]} Value to be passed for radius of a Circle SVG element.
 */
export const zoomToPixelMeters = ({ latitude, meters, zoom }) =>
  meters / metersPerPixel({ latitude, zoom });

/**
 * Return HEX color for the type of hosting offer
 *
 * @param  {String} [offerType='other']
 * @param  {String} [offerStatus='yes']
 * @return {string} HEX value
 */
export const getOfferHexColor = ({
  offerType = 'other',
  offerStatus = 'yes',
}) => {
  if (offerType === 'host' && offerStatus === 'yes') {
    return '#5cb85c'; // hosting, yes
  }

  if (offerType === 'host' && offerStatus === 'maybe') {
    return '#f0ad4e'; // hosting, maybe
  }

  if (offerType === 'host' && offerStatus === 'no') {
    return '#d9534f'; // hosting, no
  }

  if (offerType === 'meet') {
    return '#0081a1'; // meet
  }

  return '#000';
};
