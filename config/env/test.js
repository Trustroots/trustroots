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
  // Feature flags
  featureFlags: {
    // enable references at all?
    reference: true
    // Tribe endorsements for user references
    // referenceTribeEndorsements: false,
    // Free text feedback in references
    // referenceFreetextFeedback: false
  },
  db: {
    uri: 'mongodb://' + (process.env.DB_1_PORT_27017_TCP_ADDR || 'localhost') + '/trustroots-test',
    options: {
      auth: {
        authMechanism: ''
      }
      // user: '',
      // pass: ''
    },
    // Mongoose debug mode
    debug: false,
    // Check for MongoDB version compatibility on start
    checkCompatibility: false
  },
  maxUploadSize: 10000, // =10kb in bytes. Set ridiculously small just for tests
  port: 3001,
  illegalStrings: ['trustroots', 'trust', 'roots'],
  app: {
    title: 'Trustroots test environment.',
    description: 'Trustroots test environment.'
  },
  influxdb: {
    enabled: false,
    options: {
      host: 'localhost',
      port: 8086,
      protocol: 'http',
      database: 'trustroots-test'
    }
  },
  // Configuration of stathat.
  // www.stathat.com is a tool/service for tracking statistics
  stathat: {
    enabled: false,
    key: ''
  },
  mapbox: {
    // Mapbox is publicly exposed to the frontend
    user: process.env.MAPBOX_USERNAME || 'trustroots',
    map: {
      default: process.env.MAPBOX_MAP_DEFAULT || false,
      satellite: process.env.MAPBOX_MAP_SATELLITE || false,
      hitchmap: process.env.MAPBOX_MAP_HITCHMAP || false
    },
    publicKey: process.env.MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoidHJ1c3Ryb290cyIsImEiOiJVWFFGa19BIn0.4e59q4-7e8yvgvcd1jzF4g'
  }
};
