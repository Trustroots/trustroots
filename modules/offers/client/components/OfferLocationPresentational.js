// External dependencies
import React from 'react';
import PropTypes from 'prop-types';
import L from 'leaflet';
import { Map, Circle, Marker } from 'react-leaflet';

// Internal dependencies
import MapLayers from '../../../core/client/components/MapLayers.component';

export default function OfferLocationPresentational({
  zoom,
  location,
  onChangeZoom,
  marker = '',
  windowWidth,
}) {
  return (
    <Map
      className="offer-location"
      attributionControl={false}
      zoom={zoom}
      center={location}
      onZoom={({ target: { _zoom: zoom } }) => onChangeZoom(zoom)}
      scrollWheelZoom={false}
    >
      <MapLayers />
      {/* @TODO Circle and Marker will need to be reusable when we migrate the /search to React */}
      {zoom >= 12 ? (
        <Circle
          center={location}
          radius={500}
          weight={2}
          color="#989898"
          fillColor="#b1b1b1"
          fillOpacity={0.5}
          clickable={false}
          interactive={false}
          layer="locationPath"
        />
      ) : (
        <Marker
          position={location}
          layer="locationMarker"
          clickable={false}
          focus={false}
          icon={getIcon(marker, windowWidth)}
        />
      )}
    </Map>
  );
}

/**
 * Get url of marker icon
 *
 * @param {String} marker - maybe, meet, yes or an empty string
 */
function getMarkerUrl(marker) {
  const markerFile = marker ? `-${marker}` : '';
  return `/img/map/marker-icon${markerFile}.svg`;
}

/**
 * Size of the map icon in pixels (bigger for smaller screens)
 * @param {Number} windowWidth - current width of window
 * @returns {Number} - icon size
 *
 * @TODO use window.matchMedia
 * https://github.com/Trustroots/trustroots/pull/1023#discussion_r257518997
 * perhaps in the related smart component
 */
function getIconSize(windowWidth) {
  return windowWidth < 768 ? 30 : 20;
}

/**
 * Get aria label for accessibility
 *
 * @TODO add translations
 */
function getAriaLabel(marker) {
  switch (marker) {
    case 'yes':
      return 'Yes host';
    case 'maybe':
      return 'Maybe host';
    case 'meet':
      return 'Meet host';
    default:
      return 'Other';
  }
}

/**
 * Get marker icon object
 *
 * http://leafletjs.com/reference-1.2.0.html#icon
 *
 * @param {String} marker - Simplified offer name (yes|maybe|no|meet)
 * @return {Object} Leaflet icon object
 */
function getIcon(marker, windowWidth) {
  const iconSize = getIconSize(windowWidth);

  return new L.Icon({
    iconUrl: getMarkerUrl(marker),
    iconRetinaUrl: getMarkerUrl(marker),
    iconAnchor: [iconSize / 2, iconSize / 2],
    iconSize: [iconSize, iconSize],
    ariaLabel: getAriaLabel(marker),
  });
}

OfferLocationPresentational.propTypes = {
  zoom: PropTypes.number.isRequired,
  location: PropTypes.array.isRequired,
  onChangeZoom: PropTypes.func.isRequired,
  marker: PropTypes.string,
  windowWidth: PropTypes.number.isRequired,
};
