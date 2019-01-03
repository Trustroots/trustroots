import React from 'react';
import PropTypes from 'prop-types';
import L from 'leaflet';

import { Map, TileLayer, Circle, Marker } from 'react-leaflet';

function OfferLocationPresentational({ zoom, location, onChangeZoom, marker='', windowWidth }) {

  const iconSize = getIconSize(windowWidth);

  const icon = new L.Icon({
    iconUrl: getMarkerUrl(marker),
    iconRetinaUrl: getMarkerUrl(marker),
    iconAnchor: [iconSize / 2, iconSize / 2],
    iconSize: [iconSize, iconSize],
    ariaLabel: getAriaLabel(marker)
  });

  return (
    <Map
      className="offer-location"
      attributionControl={false}
      zoom={zoom}
      center={location}
      onZoom={({ target: { _zoom: zoom } }) => onChangeZoom(zoom)}
    >
      <TileLayer
        attribution='&amp;copy <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
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
          icon={icon}
        />
      }
    </Map>
  );
}

function getMarkerUrl(marker) {
  const markerName = ['marker', 'icon', ...((marker) ? [marker] : [])].join('-');
  return `/img/map/${markerName}.svg`;
};

function getIconSize(windowWidth) {
  return (windowWidth < 768) ? 30 : 20;
}

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

OfferLocationPresentational.propTypes = {
  zoom: PropTypes.number.isRequired,
  location: PropTypes.array.isRequired,
  onChangeZoom: PropTypes.func.isRequired,
  marker: PropTypes.string,
  windowWidth: PropTypes.number.isRequired
};


export default class OfferLocation extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      zoom: 13,
      windowWidth: 0
    };

    this.handleChangeZoom = this.handleChangeZoom.bind(this);
    this.updateWindowDimensions = this.updateWindowDimensions.bind(this);
  }

  /* updating windows size with https://stackoverflow.com/a/42141641 */
  componentDidMount() {
    this.updateWindowDimensions();
    window.addEventListener('resize', this.updateWindowDimensions);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateWindowDimensions);
  }

  updateWindowDimensions() {
    console.log('**************', window.innerWidth);
    this.setState(() => ({ windowWidth: window.innerWidth }));
  }

  handleChangeZoom(zoom) {
    this.setState(() => ({ zoom }));
  }

  render() {

    const marker = getOfferMarkerType(this.props.offer);

    return <OfferLocationPresentational
      zoom={this.state.zoom}
      location={this.props.offer.location}
      marker={marker}
      onChangeZoom={this.handleChangeZoom}
      windowWidth={this.state.windowWidth}
    />;
  }
};

OfferLocation.propTypes = {
  offer: PropTypes.object.isRequired
};

function getOfferMarkerType(offer) {
  const { type='other', status='yes' } = offer;

  if (type === 'host' && status === 'yes') return 'yes';
  if (type === 'host' && status === 'maybe') return 'maybe';
  if (type === 'host' && status === 'no') return 'no';
  if (type === 'meet') return 'meet';
  return '';
}


/*
(function () {
  'use strict';

    // Size of the map icon in pixels (bigger for smaller screens)
    var markerIconSize = $window.innerWidth < 768 ? 30 : 20;

    // Base path for icon images
    var path = '/img/map/';

    // Leaflet.js
    var Leaflet = $window.L;

    var service = {
      getIconConfig: getIconConfig,
      getIcon: getIcon,
      getOfferCircle: getOfferCircle
    };

    return service;

    /**
     * Get marker icon object
     *
     * http://leafletjs.com/reference-1.2.0.html#icon
     *
     * @param {Object} offer - Offer with `status`
     * @return {Object} Leaflet icon object
     *
    function getIcon(offer) {
      return Leaflet.icon(getIconConfig(offer));
    }

    /**
     * Get marker icon config
     *
     * http://leafletjs.com/reference-1.2.0.html#icon
     *
     * @param {Object} offer - Offer with `status`
     * @return {Object} Leaflet icon options
     *
    function getIconConfig(offer) {

      // Set defaults
      offer.type = offer.type || 'other';
      offer.status = offer.status || 'yes';

      // Default icon settings
      var config = {
        // Default icon image
        iconUrl: path + 'marker-icon.svg',

        // ARIA for Accessibility
        ariaLabel: 'Other',

        // size of the icon in px
        iconSize: [
          markerIconSize,
          markerIconSize
        ],

        // point of the icon which will correspond to marker's location
        iconAnchor: [
          parseInt(markerIconSize / 2, 10),
          parseInt(markerIconSize / 2, 10)
        ]
      };

      if (offer.type === 'host' && offer.status === 'yes') {
        config.iconUrl = path + 'marker-icon-yes.svg';
        config.ariaLabel = 'Yes host';
      } else if (offer.type === 'host' && offer.status === 'maybe') {
        config.iconUrl = path + 'marker-icon-maybe.svg';
        config.ariaLabel = 'Maybe host';
      } else if (offer.type === 'meet') {
        config.iconUrl = path + 'marker-icon-meet.svg';
        config.ariaLabel = 'Meet host';
      }

      return config;
    }

    /**
     * Leaflet path configuration for circle under offer markers
     *
     * @param {Object} defaults - pass any key to add or replace in default circle config
     *
    function getOfferCircle(defaults) {
      return angular.extend({
        weight: 2,
        color: '#989898',
        fillColor: '#b1b1b1',
        fillOpacity: 0.5,
        radius: 500, // Meters
        type: 'circle',
        clickable: false,

        // Circle will not emit mouse events and will act as a part of the underlying map
        interactive: false,

        // Note that by default circle is places at "Null Island"
        // @link https://en.wikipedia.org/wiki/Null_Island
        // Accepts Leaflet.LatLng
        // @linkhttp://leafletjs.com/reference-1.2.0.html#latlng
        latlngs: [0, 0]

      }, defaults || {});

    }

  }

}());
*/
