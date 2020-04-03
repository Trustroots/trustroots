import React from 'react';
import PropTypes from 'prop-types';

export default function OfferHostEditLocation({
  firstTimeAround,
  status,
  defaultZoom,
  location,
  onChangeLocation,
}) {
  firstTimeAround;
  status;
  return (
    <>
      <li>default zoom: {defaultZoom}</li>
      <li>
        location:
        <input
          value={location.lat}
          onChange={event =>
            onChangeLocation({ ...location, lat: +event.target.value })
          }
        />
        <input
          value={location.lng}
          onChange={event =>
            onChangeLocation({ ...location, lng: +event.target.value })
          }
        />
      </li>
    </>
  );
}

OfferHostEditLocation.propTypes = {
  firstTimeAround: PropTypes.bool,
  status: PropTypes.oneOf(['yes', 'maybe', 'no']).isRequired,
  defaultZoom: PropTypes.number.isRequired,
  location: PropTypes.object.isRequired,
  onChangeLocation: PropTypes.func.isRequired,
};
