(function () {
  'use strict';

  /**
   * Service for getting map layers for Leaflet
   *
   * Configure `mapbox` object at environment configs
   *
   * If Mapbox `user` or `publicKey` are set false,
   * fall back to OSM and MapQuest
   */
  angular
    .module('core')
    .factory('MapLayersFactory', MapLayersFactory);

  /* @ngInject */
  function MapLayersFactory($log, SettingsFactory, LocationService) {

    var appSettings = SettingsFactory.get();

    // Is Mapbox configuration available
    var isMapboxAvailable = (appSettings.mapbox && angular.isObject(appSettings.mapbox.maps) && angular.isString(appSettings.mapbox.user) && angular.isString(appSettings.mapbox.publicKey));

    // Location for "improve this map"-links
    var location = LocationService.getDefaultLocation(3);

    var service = {
      getLayers: getLayers
    };

    return service;


    /**
     * Return object for Mapbox layer
     */
    function getMapboxLayer(label, TRStyle, layerConf) {

      if (!isMapboxAvailable || !layerConf) return;

      var layer = {
        name: label || 'Mapbox',
        type: 'xyz',
        layerParams: {
          map: layerConf.map,
          user: layerConf.user || appSettings.mapbox.user,
          token: appSettings.mapbox.publicKey
        },
        layerOptions: {
          attribution: '<a href="https://www.mapbox.com/about/maps/" target="_blank">© Mapbox © OpenStreetMap</a>',
          continuousWorld: true,
          TRStyle: TRStyle || 'streets' // Not native Leaflet key, required by our layer switch
        }
      };

      if (layerConf.legacy) {
        // Legacy tiles URL
        layer.url = 'https://{s}.tiles.mapbox.com/v4/{user}.{map}/{z}/{x}/{y}.png?access_token={token}&secure=1';
      } else {
        // Publicly available Mapbox styles URL
        layer.url = 'https://api.mapbox.com/styles/v1/{user}/{map}/tiles/{z}/{x}/{y}?access_token={token}';
      }

      // This feedback layer id is good for private styles
      var feedbackLayer = appSettings.mapbox.user + '.' + layerConf.map;

      // These feedback layer id's are required for public styles
      if (!layerConf.legacy && TRStyle === 'satellite') {
        feedbackLayer = 'mapbox.satellite';
      } else if (!layerConf.legacy) {
        feedbackLayer = 'mapbox.streets';
      }

      // Add feedback link to attribution info
      layer.layerOptions.attribution += ' <a href="https://www.mapbox.com/map-feedback/#' +
                                            feedbackLayer + '/' +
                                            location.lng + '/' +
                                            location.lat + '/' +
                                            location.zoom + '" target="_blank" class="improve-map">Improve the underlying map</a>';


      return layer;
    }

    /**
     * Return object containing different Leaflet layers
     */
    function getLayers(options) {

      var layers = {};

      // Set layer types to return
      // Defaults to return only `streets` layer
      options = angular.merge({
        streets: true,
        satellite: false,
        outdoors: false
      }, options || {});

      // Streets
      if (options.streets && isMapboxAvailable && appSettings.mapbox.maps.streets) {
        // Streets: Mapbox
        layers.streets = getMapboxLayer(
          'Streets',
          'streets',
          appSettings.mapbox.maps.streets
        );
        // Streets fallback
      } else if (options.streets) {
        // Streets: OpenStreetMap
        layers.streets = {
          name: 'Streets',
          type: 'xyz',
          url: '//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          layerOptions: {
            subdomains: ['a', 'b', 'c'],
            attribution: '<a href="https://www.openstreetmap.org/" target="_blank">© OpenStreetMap</a> <a href="https://www.openstreetmap.org/login#map=' + location.zoom + '/' + location.lat + '/' + location.lng + '" target="_blank" class="improve-map">Improve the underlying map</a>',
            continuousWorld: true,
            TRStyle: 'streets' // Not native Leaflet key, required by our layer switch
          }
        };
      }

      // Satellite
      if (options.satellite && isMapboxAvailable && appSettings.mapbox.maps.satellite) {
        // Satellite: Mapbox
        layers.satellite = getMapboxLayer(
          'Satellite',
          'satellite',
          appSettings.mapbox.maps.satellite
        );
      } else if (options.satellite) {
        // Satellite fallback: MapQuest
        layers.satellite = {
          name: 'Satellite',
          type: 'xyz',
          url: '//otile{s}.mqcdn.com/tiles/1.0.0/sat/{z}/{x}/{y}.jpg',
          layerOptions: {
            subdomains: ['1', '2', '3', '4'],
            attribution: '<a href="http://www.mapquest.com/" target="_blank">© MapQuest</a>',
            continuousWorld: true,
            TRStyle: 'satellite' // Not native Leaflet key, required by our layer switch
          }
        };
      }

      // Outdoors (without fallback)
      if (options.outdoors && isMapboxAvailable && appSettings.mapbox.maps.outdoors) {
        // Outdoors: Mapbox
        layers.outdoors = getMapboxLayer(
          'Outdoors',
          'streets',
          appSettings.mapbox.maps.outdoors
        );
      }

      return layers;
    }

  }

}());
