import React from 'react';
import PropTypes from 'prop-types';
import L from 'leaflet';

import { Map, TileLayer, Circle, Marker } from 'react-leaflet';

export default function OfferLocationPresentational({ zoom, location, onChangeZoom, marker='', windowWidth }) {

  return (
    <Map
      className="offer-location"
      attributionControl={false}
      zoom={zoom}
      center={location}
      onZoom={({ target: { _zoom: zoom } }) => onChangeZoom(zoom)}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&amp;copy <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {/* @TODO Circle and Marker will need to be reusable when we migrate the /search to React */}
      {(zoom >= 12) ?
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
        /> :
        <Marker
          position={location}
          layer="locationMarker"
          clickable={false}
          focus={false}
          icon={getIcon(marker, windowWidth)}
        />
      }
    </Map>
  );
}

/**
 * Get url of marker icon
 */
function getMarkerUrl(marker) {
  const markerName = ['marker', 'icon', ...((marker) ? [marker] : [])].join('-');
  return `/img/map/${markerName}.svg`;
};

/**
 * Size of the map icon in pixels (bigger for smaller screens)
 * @param {Number} windowWidth - current width of window
 * @returns {Number} - icon size
 */
function getIconSize(windowWidth) {
  return (windowWidth < 768) ? 30 : 20;
}

/**
 * Get aria label for accessibility
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
    ariaLabel: getAriaLabel(marker)
  });
}

OfferLocationPresentational.propTypes = {
  zoom: PropTypes.number.isRequired,
  location: PropTypes.array.isRequired,
  onChangeZoom: PropTypes.func.isRequired,
  marker: PropTypes.string,
  windowWidth: PropTypes.number.isRequired
};


