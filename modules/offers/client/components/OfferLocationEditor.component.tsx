import React, { useMemo, useRef, useState } from 'react';
import { Alert } from '@trustroots/ui/Alert';

import lazyMap from '@/modules/core/client/components/lazyMap';
import { DEFAULT_LOCATION } from '@/modules/core/client/utils/constants';
import useMapDefaultLocation, {
  type MapDefaultLocation,
} from '@/modules/core/client/utils/use-map-default-location';
import MapDefaultAttribution from '@/modules/core/client/components/Map/MapDefaultAttribution';
import DeviceLocationButton from '@/modules/core/client/components/DeviceLocationButton';
import type { DeviceLocation } from '@/modules/core/client/utils/use-device-location';
import SearchPlaceInput from '@/modules/search/client/components/SearchPlaceInput.component';
import type {
  MapBounds,
  MapPoint,
} from '@/modules/search/client/utils/location';

const Map = lazyMap(() => import('@/modules/core/client/components/Map/index'));
const OfferLocationOverlay = lazyMap(() => import('./OfferLocationOverlay'));

interface OfferLocationEditorProps {
  location: [number, number] | null;
  offerStatus?: string;
  offerType?: string;
  showHostingGuide?: boolean;
  onLocationChange: (location: [number, number]) => void;
}

interface OfferMapProps {
  children?: React.ReactNode;
  'aria-describedby'?: string;
  className: string;
  height: number | string;
  location: [number, number];
  onLocationChange?: (location: [number, number]) => void;
  scrollZoom: boolean;
  width: string;
  zoom: number;
}

const TypedMap = Map as unknown as React.ComponentType<OfferMapProps>;
const locationPrivacy =
  'If your offer is visible to another member, the map shows them a point about 100 to 200 metres from the location you choose. Your exact location stays private.';

export default function OfferLocationEditor({
  location,
  offerStatus = 'yes',
  offerType = 'host',
  showHostingGuide = false,
  onLocationChange,
}: OfferLocationEditorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showGuide, setShowGuide] = useState(showHostingGuide);
  const [showLocationFeedback, setShowLocationFeedback] = useState(true);
  const [mapSelectionZoom, setMapSelectionZoom] = useState<number | null>(null);
  const applyDeviceLocation = useRef(true);
  const [deviceApproximateLocation, setDeviceApproximateLocation] =
    useState<MapDefaultLocation | null>(null);
  const [approximateLocation, stopDefaultLocation] =
    useMapDefaultLocation(!location);
  // A new centre asks the map to move, so retain the same tuple while only UI
  // state (such as feedback or the search query) changes.
  const mapLocation = useMemo<[number, number]>(() => {
    const approximate = deviceApproximateLocation ?? approximateLocation;
    if (location && !deviceApproximateLocation) return location;
    return approximate
      ? [approximate.latitude, approximate.longitude]
      : [DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng];
  }, [approximateLocation, deviceApproximateLocation, location]);
  const mapZoom =
    deviceApproximateLocation?.zoom ??
    mapSelectionZoom ??
    (location?.length === 2
      ? 13
      : (approximateLocation?.zoom ?? DEFAULT_LOCATION.zoom));
  const isHosting = offerType === 'host';
  const mapGuidance = (
    <p className={isHosting ? 'offer-map-guidance' : 'lead'} id="offerLocation">
      <strong>
        Zoom in, then click or drag the map to place the marker over your home.
      </strong>
      {!showHostingGuide && (
        <>
          <br />
          {locationPrivacy}
        </>
      )}
      {approximateLocation && (
        <>
          <br />
          <MapDefaultAttribution />
        </>
      )}
    </p>
  );

  function handleMapInteraction() {
    stopDefaultLocation();
    applyDeviceLocation.current = false;
    setShowGuide(false);
    setShowLocationFeedback(false);
  }

  function beginDeviceLocationRequest() {
    stopDefaultLocation();
    applyDeviceLocation.current = true;
    setShowGuide(false);
    setShowLocationFeedback(true);
  }

  function selectLocation(
    nextLocation: [number, number],
    selectionZoom: number | null,
  ) {
    handleMapInteraction();
    setDeviceApproximateLocation(null);
    setMapSelectionZoom(selectionZoom);
    onLocationChange(nextLocation);
  }

  function handlePlaceSearch(
    data: MapBounds | MapPoint,
    type: 'center' | 'bounds',
  ) {
    if (
      type === 'center' &&
      'lat' in data &&
      Number.isFinite(data.lat) &&
      Number.isFinite(data.lng)
    ) {
      selectLocation([data.lat, data.lng], null);
    } else if (
      type === 'bounds' &&
      'northEast' in data &&
      data.northEast &&
      data.southWest
    ) {
      const lat = (data.northEast.lat + data.southWest.lat) / 2;
      const lng = (data.northEast.lng + data.southWest.lng) / 2;
      selectLocation([lat, lng], null);
    }
  }

  function handleMapLocationChange(nextLocation: [number, number]) {
    // The unchosen map centre is not an offer location.
    if (
      !location &&
      nextLocation[0] === DEFAULT_LOCATION.lat &&
      nextLocation[1] === DEFAULT_LOCATION.lng
    ) {
      handleMapInteraction();
      return;
    }
    // Preserve the live map zoom when a gesture chooses the first location.
    selectLocation(nextLocation, mapZoom);
  }

  function handleDeviceLocation(location: DeviceLocation) {
    if (applyDeviceLocation.current) {
      selectLocation([location.lat, location.lng], null);
    }
  }

  function handleApproximateLocation(location: MapDefaultLocation) {
    if (applyDeviceLocation.current) {
      stopDefaultLocation();
      setDeviceApproximateLocation(location);
    }
  }

  return (
    <div
      className="panel panel-default offer-panel-map"
      onPointerDownCapture={stopDefaultLocation}
      onTouchStartCapture={stopDefaultLocation}
      onWheelCapture={stopDefaultLocation}
      onKeyDownCapture={stopDefaultLocation}
    >
      <div className={isHosting ? 'offer-location-search' : 'panel-body'}>
        {!isHosting && mapGuidance}
        <SearchPlaceInput
          id="offer-search-query"
          onPlaceSearch={handlePlaceSearch}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      </div>
      <div className="offer-map">
        <div
          className="offer-map-surface"
          onPointerDownCapture={handleMapInteraction}
          onTouchStartCapture={handleMapInteraction}
          onClickCapture={handleMapInteraction}
          onWheelCapture={handleMapInteraction}
          onKeyDownCapture={event => {
            if (
              event.key.startsWith('Arrow') ||
              ['Enter', ' ', '+', '=', '-'].includes(event.key)
            ) {
              handleMapInteraction();
            }
          }}
        >
          <TypedMap
            aria-describedby="offerLocation"
            className="offer-location"
            height="100%"
            location={mapLocation}
            onLocationChange={handleMapLocationChange}
            scrollZoom
            width="100%"
            zoom={mapZoom}
          >
            {location?.length === 2 && !deviceApproximateLocation && (
              <OfferLocationOverlay
                location={location}
                offerStatus={offerStatus}
                offerType={offerType}
              />
            )}
          </TypedMap>
        </div>
        <div className="offer-location-overlay"></div>
        {showGuide && (
          <Alert className="offer-map-guide" intent="info" role="note">
            <strong>Set your hosting location on the map.</strong>
            <br />
            {locationPrivacy}
          </Alert>
        )}
        <DeviceLocationButton
          onApproximateLocation={handleApproximateLocation}
          onLocation={handleDeviceLocation}
          onRequest={beginDeviceLocationRequest}
          showFeedback={showLocationFeedback}
        />
      </div>
      {isHosting && <div className="panel-body">{mapGuidance}</div>}
    </div>
  );
}
