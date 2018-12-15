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
      // user: '',
      // pass: ''
    },
    // Mongoose debug mode
    debug: false,
    // Check for MongoDB version compatibility on start
    checkCompatibility: false
  }
};
