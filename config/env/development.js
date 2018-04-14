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
    // See http://mongoosejs.com/docs/connections.html#options
    options: {
      autoIndex: true,
      // Never stop trying to reconnect
      reconnectTries: Number.MAX_VALUE,
      // Reconnect every 500ms
      reconnectInterval: 500,
      // If not connected, return errors immediately rather than waiting for reconnect
      bufferMaxEntries: 0
    },
    // Mongoose debug mode
    debug: true
  },
  app: {
    title: 'Trustroots Development version',
    description: 'Trustroots development version.'
  },
  // Configuration to work with default MailDev dev setup
  // https://github.com/djfarrelly/MailDev
  mailer: {
    from: 'trustroots@localhost',
    options: {
      host: 'localhost',
      port: 1025,
      ignoreTLS: true,
      auth: false,
      pool: true
    }
  }
};
