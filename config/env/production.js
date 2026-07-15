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
  umami: {
    scriptSrc: 'https://1p.trustroots.org/script.js',
    websiteId: '23ec0c85-2ebc-4d85-9063-c23d90b8ded1',
  },
  db: {
    uri:
      'mongodb://' +
      (process.env.DB_1_PORT_27017_TCP_ADDR || 'localhost') +
      '/trustroots',
    options: {
      auth: {
        authMechanism: '',
      },
      // user: '',
      // pass: ''
    },
    // Mongoose debug mode
    debug: false,
    // Autoindex indexes
    // Mongoose calls createIndex on each Model's index when staring the app
    autoIndex: false,
    // Check for MongoDB version compatibility on start
    checkCompatibility: false,
    // Use `/tmp/trustroots/` for uploads in production
    uploadTmpDir: '/tmp/trustroots/',
  },
};
