// External dependencies
import React from 'react';

// Internal dependencies
import Map from '@/modules/core/client/components/Map/index';
import OfferLocationOverlay from './OfferLocationOverlay';
import { getOfferHexColor } from '../utils/markers.js';

interface OfferLocationProps {
  location: [number, number];
  offerStatus?: string;
  offerType?: string;
}

export default function OfferLocation({
  location,
  offerStatus,
  offerType,
}: OfferLocationProps) {
  if (!location || location.length !== 2) {
    return null;
  }

  return (
    <Map
      aria-hidden
      className="offer-location"
      fallbackMarker={{
        color: getOfferHexColor({ offerType, offerStatus }),
        location,
      }}
      height={320}
      location={location}
      scrollZoom={false}
      width="100%"
      zoom={11}
    >
      <OfferLocationOverlay
        location={location}
        offerType={offerType}
        offerStatus={offerStatus}
      />
    </Map>
  );
}
