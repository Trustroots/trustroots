/**
 * Service for getting map layers for Leaflet
 *
 * Configure `mapbox` object at environment configs
 *
 * If Mapbox `user` or `publicKey` are set false,
 * fall back to OSM and MapQuest
 */
angular.module('core').factory('MapLayersFactory', MapLayersFactory);

/* @ngInject */
function MapLayersFactory(SettingsFactory, LocationService) {
  const appSettings = SettingsFactory.get();

  // Is Mapbox configuration available
  const isMapboxAvailable =
    appSettings.mapbox &&
    angular.isObject(appSettings.mapbox.maps) &&
    appSettings.mapbox.user &&
    appSettings.mapbox.publicKey;

  // Location for "improve this map"-links
  const location = LocationService.getDefaultLocation(3);

  const service = {
    getLayers,
  };

  return service;

  /**
   * Return object for Mapbox layer
   */
  function getMapboxLayer(label, TRStyle, layerConf) {
    if (!isMapboxAvailable || !layerConf) return;

    const layer = {
      name: label || 'Mapbox',
      type: 'xyz',
      layerParams: {
        map: layerConf.map,
        user: layerConf.user || appSettings.mapbox.user,
        token: appSettings.mapbox.publicKey,
      },
      layerOptions: {
        attribution:
          '<a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">© Mapbox © OpenStreetMap</a>',
        continuousWorld: true,
        TRStyle: TRStyle || 'streets', // Not native Leaflet key, required by our layer switch
      },
    };

    if (layerConf.legacy) {
      // Legacy tiles URL
      layer.url =
        'https://{s}.tiles.mapbox.com/v4/{user}.{map}/{z}/{x}/{y}.png?access_token={token}&secure=1';
    } else {
      // Publicly available Mapbox styles URL
      layer.url =
        'https://api.mapbox.com/styles/v1/{user}/{map}/tiles/{z}/{x}/{y}?access_token={token}';
    }

    // This feedback layer id is good for private styles
    let feedbackLayer = appSettings.mapbox.user + '.' + layerConf.map;

    // These feedback layer id's are required for public styles
    if (!layerConf.legacy && TRStyle === 'satellite') {
      feedbackLayer = 'mapbox.satellite';
    } else if (!layerConf.legacy) {
      feedbackLayer = 'mapbox.streets';
    }

    // Add feedback link to attribution info
    layer.layerOptions.attribution +=
      ' <a href="https://www.mapbox.com/map-feedback/#' +
      feedbackLayer +
      '/' +
      location.lng +
      '/' +
      location.lat +
      '/' +
      location.zoom +
      '" ' +
      'target="_blank" rel="noopener" class="improve-map">' +
      'Improve the underlying map' +
      '</a>';

    return layer;
  }

  /**
   * Return object containing different Leaflet layers
   */
  function getLayers(options) {
    const layers = {};

    // Set layer types to return
    // Defaults to return only `streets` layer
    options = angular.merge(
      {
        streets: true,
        satellite: false,
        outdoors: false,
      },
      options || {},
    );

    // Streets
    if (
      options.streets &&
      isMapboxAvailable &&
      appSettings.mapbox.maps.streets
    ) {
      // Streets: Mapbox
      layers.streets = getMapboxLayer(
        'Streets',
        'streets',
        appSettings.mapbox.maps.streets,
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
          attribution:
            '<a href="https://www.openstreetmap.org/" target="_blank" ' +
            'rel="noopener">© OpenStreetMap</a> ' +
            '<a href="https://www.openstreetmap.org/login#map=' +
            location.zoom +
            '/' +
            location.lat +
            '/' +
            location.lng +
            '" target="_blank" class="improve-map">' +
            'Improve the underlying map' +
            '</a>',
          continuousWorld: true,
          TRStyle: 'streets', // Not native Leaflet key, required by our layer switch
        },
      };
    }

    // Satellite
    if (
      options.satellite &&
      isMapboxAvailable &&
      appSettings.mapbox.maps.satellite
    ) {
      // Satellite: Mapbox
      layers.satellite = getMapboxLayer(
        'Satellite',
        'satellite',
        appSettings.mapbox.maps.satellite,
      );
    } else if (options.satellite) {
      // Satellite fallback: NASA Earth Data
      // @link https://earthdata.nasa.gov/about/science-system-description/eosdis-components/global-imagery-browse-services-gibs
      // @link https://wiki.earthdata.nasa.gov/display/GIBS/GIBS+API+for+Developers#GIBSAPIforDevelopers-ServiceEndpointsandGetCapabilities
      // @link https://github.com/nasa-gibs/gibs-web-examples/blob/master/examples/leaflet/webmercator-epsg3857.js
      layers.satellite = {
        name: 'Satellite',
        type: 'xyz',
        url: '//gibs-{s}.earthdata.nasa.gov/wmts/epsg3857/best/{layer}/default/{time}/{tileMatrixSet}/{z}/{y}/{x}.jpg',
        layerOptions: {
          layer: 'Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual',
          tileMatrixSet: 'GoogleMapsCompatible_Level12',
          time: '2009-08-22',
          subdomains: ['a', 'b', 'c'],
          attribution:
            '<a href="https://wiki.earthdata.nasa.gov/display/GIBS" target="_blank" rel="noopener">© NASA Earth Data</a>',
          noWrap: true,
          continuousWorld: true,
          tileSize: 256,
          // Prevent Leaflet from retrieving non-existent tiles on the borders
          bounds: [
            [-85.0511287776, -179.999999975],
            [85.0511287776, 179.999999975],
          ],
          TRStyle: 'satellite', // Not native Leaflet key, required by our layer switch
        },
      };
    }

    // Outdoors (without fallback)
    if (
      options.outdoors &&
      isMapboxAvailable &&
      appSettings.mapbox.maps.outdoors
    ) {
      // Outdoors: Mapbox
      layers.outdoors = getMapboxLayer(
        'Outdoors',
        'streets',
        appSettings.mapbox.maps.outdoors,
      );
    }

    return layers;
  }
}
