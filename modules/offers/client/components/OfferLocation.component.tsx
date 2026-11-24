import React, { useMemo } from 'react';

import Map from '@/modules/core/client/components/Map/index';
import { getOfferHexColor } from '../utils/markers';

interface OfferLocationProps {
  location?: number[];
  height?: number;
  offerStatus?: string;
  offerType?: string;
}

export default function OfferLocation({
  location,
  offerStatus,
  offerType,
  height = 320,
}: OfferLocationProps) {
  const [latitude = 0, longitude = 0] = location ?? [];
  const view = useMemo(
    () => ({ latitude, longitude, zoom: 11 }),
    [latitude, longitude],
  );

  if (location?.length !== 2) {
    return null;
  }

  return (
    <Map
      aria-hidden
      className="offer-location"
      style={{ height, width: '100%' }}
      view={view}
      scrollZoom={false}
      area={{
        latitude,
        longitude,
        colour: getOfferHexColor({ offerType, offerStatus }),
      }}
    />
  );
}
