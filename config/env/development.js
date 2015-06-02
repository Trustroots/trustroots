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
    uri: 'mongodb://localhost/trust-roots-dev',
    options: {
      user: '',
      pass: ''
    }
  },
  app: {
    title: 'Trustroots Development version',
    description: 'Trustroots development version.',
    tagline: 'This is a test version, please go to Trustroots.org for the real one.'
  },
  // See https://github.com/andris9/Nodemailer#tldr-usage-example how to configure mailer
  // In production we're using Mandrill https://mandrillapp.com
  mailer: {
    from: process.env.MAILER_FROM || 'MAILER_FROM',
    options: {
      service: process.env.MAILER_SERVICE_PROVIDER || 'MAILER_SERVICE_PROVIDER',
      auth: {
        user: process.env.MAILER_EMAIL_ID || 'MAILER_EMAIL_ID',
        pass: process.env.MAILER_PASSWORD || 'MAILER_PASSWORD'
      }
    }
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
