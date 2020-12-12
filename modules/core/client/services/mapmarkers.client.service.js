/**
 * Service for getting icons, markers and other objects for Leaflet maps
 */
angular.module('core').factory('MapMarkersFactory', MapMarkersFactory);

/* @ngInject */
function MapMarkersFactory($window) {
  // Size of the map icon in pixels (bigger for smaller screens)
  const markerIconSize = $window.innerWidth < 768 ? 30 : 20;

  // Base path for icon images
  const path = '/img/map/';

  // Leaflet.js
  const Leaflet = $window.L;

  const service = {
    getIconConfig,
    getIcon,
    getOfferCircle,
  };

  return service;

  /**
   * Get marker icon object
   *
   * http://leafletjs.com/reference-1.2.0.html#icon
   *
   * @param {Object} offer - Offer with `status`
   * @return {Object} Leaflet icon object
   */
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
   */
  function getIconConfig(offer) {
    // Set defaults
    offer.type = offer.type || 'other';
    offer.status = offer.status || 'yes';

    // Default icon settings
    const config = {
      // Default icon image
      iconUrl: path + 'marker-icon.svg',

      // ARIA for Accessibility
      ariaLabel: 'Other',

      // size of the icon in px
      iconSize: [markerIconSize, markerIconSize],

      // point of the icon which will correspond to marker's location
      iconAnchor: [
        parseInt(markerIconSize / 2, 10),
        parseInt(markerIconSize / 2, 10),
      ],
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
   */
  function getOfferCircle(defaults) {
    return angular.extend(
      {
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
        latlngs: [0, 0],
      },
      defaults || {},
    );
  }
}
