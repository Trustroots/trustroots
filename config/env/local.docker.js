'use strict';

/**
 * `local.docker.js` is copied to `local.js` by Docker provisioning
 *
 * Load order:
 * - default.js
 * - {development|production|test}.js
 * - local.js
 *
 * Available host names for other containers:
 * - `mongodb` refers to MongoDB
 * - `maildev` refers to Maildev
 * See `docker-compose.yml` and `Dockerfile` for details
 *
 */

module.exports = {
  // Need to listen on all addresses so the nginx container can access it
  host: '0.0.0.0',

  /**
   * NodeMailer settings for Maildev Docker image
   * @link https://github.com/djfarrelly/MailDev
   */
  mailer: {
    from: 'trustroots@localhost',
    options: {
      host: 'maildev',
      port: 25,
      ignoreTLS: true,
      auth: false
    }
  },

  /**
   * Settings for InfluxDB Docker image
   */
  influxdb: {
    enabled: true,
    options: {
      host: 'influxdb',
      port: 8086,
      protocol: 'http',
      username: 'root',
      password: 'root',
      database: 'trustroots'
    }
  }

  // See config/env/local.sample.js for how to configure mapbox layers, sending emails via Gmail etc

};
