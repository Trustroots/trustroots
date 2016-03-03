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

  /**
   * NodeMailer settings for Maildev Docker image
   * https://github.com/djfarrelly/MailDev
   */
  mailer: {
    from: 'hello@trustroots.dev',
    options: {
      host: 'maildev',
      port: 25,
      ignoreTLS: true,
      auth: false
    }
  }


  // See config/env/local.sample.js for how to configure mapbox layers, sending emails via Gmail etc

};
