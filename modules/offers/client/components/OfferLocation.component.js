// External dependencies
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import Map from '@/modules/core/client/components/Map/index';
import OfferLocationOverlay from './OfferLocationOverlay';

export default function OfferLocation({ location, offerType, offerStatus }) {
  if (!location || location.length !== 2) {
    return null;
  }

  return (
    <Map
      aria-hidden
      className="offer-location"
      height={320}
      location={location}
      width="100%"
      zoom={11}
      scrollZoom={false}
    >
      <OfferLocationOverlay
        location={location}
        offerType={offerType}
        offerStatus={offerStatus}
      />
    </Map>
  );
}

OfferLocation.propTypes = {
  location: PropTypes.arrayOf(PropTypes.number).isRequired,
  offerType: PropTypes.string,
  offerStatus: PropTypes.string,
};
