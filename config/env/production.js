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
    uri: 'mongodb://' + (process.env.DB_1_PORT_27017_TCP_ADDR || 'localhost') + '/trustroots',
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
  domain: process.env.DOMAIN || 'www.trustroots.org',
  mapbox: {
    // Mapbox is publicly exposed to the frontend
    user: process.env.MAPBOX_USERNAME || 'trustroots',
    map: {
      default: process.env.MAPBOX_MAP_DEFAULT || 'k8mokch5',
      satellite: process.env.MAPBOX_MAP_SATELLITE || 'kil7hee6',
      outdoors: process.env.MAPBOX_MAP_OUTDOORS || 'nehh9a3n',
      hitchmap: process.env.MAPBOX_MAP_HITCHMAP || 'ce8bb774'
    },
    publicKey: process.env.MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoidHJ1c3Ryb290cyIsImEiOiJVWFFGa19BIn0.4e59q4-7e8yvgvcd1jzF4g'
  }
};
