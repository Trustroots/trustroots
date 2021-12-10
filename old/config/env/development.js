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
  featureFlags: {
    reference: true,
  },
  // in dev we have webpack-dev-server on 3000, and the real server on 3001
  port: 3001,
  db: {
    uri:
      'mongodb://' +
      (process.env.DB_1_PORT_27017_TCP_ADDR || 'localhost') +
      '/trustroots-dev',
    options: {
      auth: {
        authMechanism: '',
      },
      // user: '',
      // pass: ''
    },
    // Mongoose debug mode
    debug: true,
    // Autoindex indexes
    // Mongoose calls createIndex on each Model's index when staring the app
    autoIndex: true,
    // Check for MongoDB version compatibility on start
    checkCompatibility: true,
  },
  app: {
    title: 'Trustroots Development version',
    description: 'Trustroots development version.',
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
      pool: true,
    },
  },
};
