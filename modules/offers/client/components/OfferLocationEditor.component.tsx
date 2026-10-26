import React, { useState } from 'react';

import Map from '@/modules/core/client/components/Map/index';
import { DEFAULT_LOCATION } from '@/modules/core/client/utils/constants';
import useMapDefaultLocation from '@/modules/core/client/utils/use-map-default-location';
import MapDefaultAttribution from '@/modules/core/client/components/Map/MapDefaultAttribution';
import OfferLocationOverlay from './OfferLocationOverlay';
import SearchPlaceInput from '@/modules/search/client/components/SearchPlaceInput.component';
import { getOfferHexColor } from '../utils/markers';
import type {
  MapBounds,
  MapPoint,
} from '@/modules/search/client/utils/location';

interface OfferLocationEditorProps {
  location: [number, number] | null;
  offerStatus?: string;
  offerType?: string;
  onLocationChange: (location: [number, number]) => void;
}

interface OfferMapProps {
  children?: React.ReactNode;
  'aria-describedby'?: string;
  className: string;
  fallbackMarker?: { color: string; location: [number, number] };
  height: number | string;
  location: [number, number];
  onLocationChange?: (location: [number, number]) => void;
  preferRaster: boolean;
  scrollZoom: boolean;
  width: string;
  zoom: number;
}

const TypedMap = Map as unknown as React.ComponentType<OfferMapProps>;

export default function OfferLocationEditor({
  location,
  offerStatus = 'yes',
  offerType = 'host',
  onLocationChange,
}: OfferLocationEditorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [approximateLocation, stopDefaultLocation] =
    useMapDefaultLocation(!location);
  const mapLocation =
    location ||
    (approximateLocation
      ? [approximateLocation.latitude, approximateLocation.longitude]
      : [DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng]);

  function handlePlaceSearch(
    data: MapBounds | MapPoint,
    type: 'center' | 'bounds',
  ) {
    stopDefaultLocation();
    if (
      type === 'center' &&
      'lat' in data &&
      Number.isFinite(data.lat) &&
      Number.isFinite(data.lng)
    ) {
      onLocationChange([data.lat, data.lng]);
    } else if (
      type === 'bounds' &&
      'northEast' in data &&
      data.northEast &&
      data.southWest
    ) {
      const lat = (data.northEast.lat + data.southWest.lat) / 2;
      const lng = (data.northEast.lng + data.southWest.lng) / 2;
      onLocationChange([lat, lng]);
    }
  }

  function handleMapLocationChange(nextLocation: [number, number]) {
    stopDefaultLocation();
    // The unchosen map centre is not an offer location.
    if (
      !location &&
      nextLocation[0] === DEFAULT_LOCATION.lat &&
      nextLocation[1] === DEFAULT_LOCATION.lng
    ) {
      return;
    }
    onLocationChange(nextLocation);
  }

  return (
    <div
      className="panel panel-default offer-panel-map"
      onPointerDownCapture={stopDefaultLocation}
      onTouchStartCapture={stopDefaultLocation}
      onWheelCapture={stopDefaultLocation}
      onKeyDownCapture={stopDefaultLocation}
    >
      <div className="panel-body">
        <p className="lead" id="offerLocation">
          <strong>
            Zoom in, then click or drag the map below to place the marker over
            your home.
          </strong>
          <br />
          The location is publicly shown, randomised by a couple hundred metres.
          {approximateLocation && (
            <>
              <br />
              <MapDefaultAttribution />
            </>
          )}
        </p>
        <SearchPlaceInput
          onDeviceLocationRequest={stopDefaultLocation}
          id="offer-search-query"
          onPlaceSearch={handlePlaceSearch}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      </div>
      <div className="offer-map">
        <TypedMap
          aria-describedby="offerLocation"
          className="offer-location"
          fallbackMarker={
            location
              ? {
                  color: getOfferHexColor({ offerType, offerStatus }),
                  location,
                }
              : undefined
          }
          height="100%"
          // Some Chromium configurations initialise WebGL but fail to draw
          // vector map detail. Raster tiles keep location selection usable.
          preferRaster
          location={mapLocation}
          onLocationChange={handleMapLocationChange}
          scrollZoom
          width="100%"
          zoom={
            /* istanbul ignore next -- offer editors initialise a two-coordinate location. */
            location?.length === 2
              ? 13
              : (approximateLocation?.zoom ?? DEFAULT_LOCATION.zoom)
          }
        >
          {location?.length === 2 && (
            <OfferLocationOverlay
              location={location}
              offerStatus={offerStatus}
              offerType={offerType}
            />
          )}
        </TypedMap>
        <div className="offer-location-overlay"></div>
      </div>
    </div>
  );
}
