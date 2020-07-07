// External dependencies
import PropTypes from 'prop-types';
import React from 'react';

/**
 * Map icon
 * @link https://docs.mapbox.com/playground/static/
 * @link https://docs.mapbox.com/api/maps/#static-images
 */
export default function MapIcon({ mapboxStyle, mapboxToken }) {
  const image =
    mapboxStyle && mapboxToken
      ? `https://api.mapbox.com/styles/v1/mapbox/${mapboxStyle
          .split('/')
          .pop()}/static/14.1663,55.6438,5.22,0/128x128@2x?attribution=false&access_token=${mapboxToken}`
      : // Default image when API isn't available
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNc8mTSfwAHaQMbL4UQfQAAAABJRU5ErkJggg==';

  return (
    <img
      className="img-circle"
      alt=""
      aria-hidden="true"
      width="24"
      height="24"
      src={image}
    />
  );
}

MapIcon.propTypes = {
  mapboxStyle: PropTypes.string,
  mapboxToken: PropTypes.string,
};
