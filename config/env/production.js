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
    // See http://mongoosejs.com/docs/connections.html#options
    options: {
      autoIndex: false,
      // Never stop trying to reconnect
      reconnectTries: Number.MAX_VALUE,
      // Reconnect every 500ms
      reconnectInterval: 500,
      // If not connected, return errors immediately rather than waiting for reconnect
      bufferMaxEntries: 0
    },
    // Mongoose debug mode
    debug: false
  },
  domain: process.env.DOMAIN || 'www.trustroots.org'
};
