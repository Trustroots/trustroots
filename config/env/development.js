'use strict';

/*
 * Please don't make your own config changes to this file!
 * Copy local.sample.js to local.js and make your changes there. Thanks.
 *
 * Load order:
 * - default.js
 * - {development|production|test}.js
 * - local.js
 */

module.exports = {
  db: {
    uri: 'mongodb://' + (process.env.DB_1_PORT_27017_TCP_ADDR || 'localhost') + '/trustroots-dev',
    options: {
      auth: {
        authMechanism: ''
      }
      //user: '',
      //pass: ''
    },
    // Enable mongoose debug mode
    debug: process.env.MONGODB_DEBUG || false
  },
  app: {
    title: 'Trustroots Development version',
    description: 'Trustroots development version.',
    tagline: 'This is a test version, please go to Trustroots.org for the real thing.'
  },
  // Mapbox is publicly exposed to the frontend
  // To use MapBox maps, copy map values from production.js
  mapbox: {
    user: process.env.MAPBOX_USERNAME || 'trustroots',
    map: {
      default: process.env.MAPBOX_MAP_DEFAULT || false,
      satellite: process.env.MAPBOX_MAP_SATELLITE || false,
      hitchmap: process.env.MAPBOX_MAP_HITCHMAP || false
    },
    publicKey: process.env.MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoidHJ1c3Ryb290cyIsImEiOiJVWFFGa19BIn0.4e59q4-7e8yvgvcd1jzF4g'
  }
};
