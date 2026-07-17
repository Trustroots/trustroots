import PropTypes from 'prop-types';
import React, { useState } from 'react';

import Map from '@/modules/core/client/components/Map/index';
import OfferLocationOverlay from './OfferLocationOverlay';
import SearchPlaceInput from '@/modules/search/client/components/SearchPlaceInput.component';
import { getOfferHexColor } from '../utils/markers';

export default function OfferLocationEditor({
  location,
  offerStatus = 'yes',
  offerType = 'host',
  onLocationChange,
}) {
  const [searchQuery, setSearchQuery] = useState('');

  function handlePlaceSearch(data, type) {
    if (type === 'center' && data?.lat && data?.lng) {
      onLocationChange([data.lat, data.lng]);
    } else if (type === 'bounds' && data?.northEast && data?.southWest) {
      const lat = (data.northEast.lat + data.southWest.lat) / 2;
      const lng = (data.northEast.lng + data.southWest.lng) / 2;
      onLocationChange([lat, lng]);
    }
  }

  return (
    <div className="panel panel-default offer-panel-map">
      <div className="panel-body">
        <p className="lead" id="offerLocation">
          <strong>
            Zoom in and drag the map below to place the marker over your home.
          </strong>
          <br />
          The location is publicly shown, randomised by a couple hundred metres.
        </p>
        <SearchPlaceInput
          id="offer-search-query"
          onPlaceSearch={handlePlaceSearch}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      </div>
      <div className="offer-map">
        <Map
          aria-describedby="offerLocation"
          className="offer-location"
          fallbackMarker={{
            color: getOfferHexColor({ offerType, offerStatus }),
            location,
          }}
          height={320}
          location={location}
          onClick={event => {
            if (event?.lngLat) {
              onLocationChange([event.lngLat[1], event.lngLat[0]]);
            }
          }}
          scrollZoom
          width="100%"
          zoom={
            /* istanbul ignore next -- offer editors initialise a two-coordinate location. */
            location?.length === 2 ? 13 : 4
          }
        >
          {location?.length === 2 && (
            <OfferLocationOverlay
              location={location}
              offerStatus={offerStatus}
              offerType={offerType}
            />
          )}
        </Map>
        <div className="offer-location-overlay"></div>
      </div>
    </div>
  );
}

OfferLocationEditor.propTypes = {
  location: PropTypes.arrayOf(PropTypes.number).isRequired,
  offerStatus: PropTypes.string,
  offerType: PropTypes.string,
  onLocationChange: PropTypes.func.isRequired,
};
