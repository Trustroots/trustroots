'use strict';

/**
 * Service for map layers
 * - Streets from Mapbox (fallback from OSM)
 * - Satellite from Mapbox (fallback from MapQuest)
 * - Other maps:
 *    - Hitchmap from Mapbox (no fallback)
 */
angular.module('core').factory('MapLayersFactory', ['SettingsFactory',
  function(SettingsFactory) {

    var appSettings = SettingsFactory.get();

    // Location for "improve this map"-links (defaults to Europe)
    var defaultLocation = {
      lat: 48.6908333333,
      lng: 9.14055555556,
      zoom: 6
    };

    var service = {};

    service.streets = function(center) {

      var location = center || defaultLocation;

      // Streets/Mapbox
      if(appSettings.mapbox.map.default && appSettings.mapbox.user && appSettings.mapbox.publicKey) {
        return {
          name: 'Streets',
          type: 'xyz',
          url: '//{s}.tiles.mapbox.com/v4/{user}.{map}/{z}/{x}/{y}.png?access_token=' + appSettings.mapbox.publicKey + ( appSettings.https ? '&secure=1' : ''),
          layerParams: {
            user: appSettings.mapbox.user,
            map: appSettings.mapbox.map.default
          },
          layerOptions: {
            attribution: '<a href="https://www.mapbox.com/map-feedback/#' + appSettings.mapbox.user + '.' + appSettings.mapbox.map.default + '/' + location.lng + '/' + location.lat + '/' + location.zoom + '">Improve map</a>',
            continuousWorld: true,
            TRStyle: 'street' // Not native Leaflet key, required by our layer switch
          }
        };
      }
      // Streets/OpenStreetMap as a fallback
      else {
        return {
          name: 'Streets',
          type: 'xyz',
          url: '//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          layerOptions: {
            subdomains: ['a', 'b', 'c'],
            attribution: '<a href="https://www.openstreetmap.org/login#map=' + location.zoom + '/' + location.lat + '/' + location.lng + '">Improve map</a>',
            continuousWorld: true,
            TRStyle: 'street' // Not native Leaflet key, required by our layer switch
          }
        };
      }

    };

    service.satellite = function(center) {

      var location = center || defaultLocation;

      // Satellite/Mapbox
      if(appSettings.mapbox.map.satellite && appSettings.mapbox.user && appSettings.mapbox.publicKey) {
        return {
          name: 'Satellite',
          type: 'xyz',
          url: '//{s}.tiles.mapbox.com/v4/{user}.{map}/{z}/{x}/{y}.png?access_token=' + appSettings.mapbox.publicKey + ( appSettings.https ? '&secure=1' : ''),
          layerParams: {
            user: appSettings.mapbox.user,
            map: appSettings.mapbox.map.satellite
          },
          layerOptions: {
            attribution: '<a href="https://www.mapbox.com/map-feedback/#' + appSettings.mapbox.user + '.' + appSettings.mapbox.map.satellite + '/' + location.lng + '/' + location.lat + '/' + location.zoom + '">Improve map</a>',
            continuousWorld: true,
            TRStyle: 'satellite' // Not native Leaflet key, required by our layer switch
          }
        };
      }
      // Satellite/MapQuest as a fallback
      else {
        return {
          name: 'Satellite',
          type: 'xyz',
          url: '//otile{s}.mqcdn.com/tiles/1.0.0/sat/{z}/{x}/{y}.jpg',
          layerOptions: {
            subdomains: ['1', '2', '3', '4'],
            attribution: '<a href="http://www.mapquest.com/">MapQuest</a>',
            continuousWorld: true,
            TRStyle: 'satellite' // Not native Leaflet key, required by our layer switch
          }
        };
      }
    };

    service.other = function (center) {

      var location = center || defaultLocation,
          layers = {};

      // Hitchmap/Mapbox (experimental, no fallback)
      if(appSettings.mapbox.map.hitchmap && appSettings.mapbox.user && appSettings.mapbox.publicKey) {
        layers.hitchmap = {
          name: 'Hitchmap',
          type: 'xyz',
          url: '//{s}.tiles.mapbox.com/v4/{user}.{map}/{z}/{x}/{y}.png?access_token=' + appSettings.mapbox.publicKey + ( appSettings.https ? '&secure=1' : ''),
          layerParams: {
            user: appSettings.mapbox.user,
            map: appSettings.mapbox.map.hitchmap
          },
          layerOptions: {
            attribution: '<a href="https://www.mapbox.com/map-feedback/#' + appSettings.mapbox.user + '.' + appSettings.mapbox.map.hitchmap + '/' + location.lng + '/' + location.lat + '/' + location.zoom + '">Improve map</a>',
            continuousWorld: true,
            TRStyle: 'street' // Not native Leaflet, required by layer switch
          }
        };
      }

      // Add any other layers here...

      return layers;

    };

    return service;
  }
]);
