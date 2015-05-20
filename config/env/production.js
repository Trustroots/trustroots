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
    uri: process.env.MONGOHQ_URL || process.env.MONGOLAB_URI || 'mongodb://' + (process.env.DB_1_PORT_27017_TCP_ADDR || 'localhost') + '/trust-roots',
    options: {
      user: '',
      pass: ''
    }
  },
  domain: process.env.DOMAIN || 'www.trustroots.org',
  mapbox: {
    // Mapbox is publicly exposed to the frontend
    user: process.env.MAPBOX_USERNAME || 'trustroots',
    map: {
      default: process.env.MAPBOX_MAP_DEFAULT || 'k8mokch5',
      satellite: process.env.MAPBOX_MAP_SATELLITE || 'kil7hee6',
      hitchmap: process.env.MAPBOX_MAP_HITCHMAP || 'ce8bb774'
    },
<<<<<<< HEAD
    less: [
      'public/modules/**/less/*.less'
    ],
    css: [
        // nada
        //'public/modules/**/css/*.css'
    ],
    js: [
      'public/config.js',
      'public/application.js',
      'public/modules/*/*.module.js',
      'public/modules/*/services/*.js',
      'public/modules/*/*.js',
      'public/modules/*/*[!tests]*/*.js'
    ]
  },
  facebook: {
    page: process.env.FACEBOOK_PAGE || 'PAGE',
    clientID: process.env.FACEBOOK_ID || 'APP_ID',
    clientSecret: process.env.FACEBOOK_SECRET || 'APP_SECRET',
    callbackURL: '/auth/facebook/callback'
  },
  twitter: {
    username: process.env.TWITTER_USERNAME || 'USERNAME',
    clientID: process.env.TWITTER_KEY || 'CONSUMER_KEY',
    clientSecret: process.env.TWITTER_SECRET || 'CONSUMER_SECRET',
    callbackURL: '/auth/twitter/callback'
  },
  google: {
    page: process.env.GOOGLE_PAGE || 'PAGE',
    clientID: process.env.GOOGLE_ID || 'APP_ID',
    clientSecret: process.env.GOOGLE_SECRET || 'APP_SECRET',
    callbackURL: '/auth/google/callback'
  },
  linkedin: {
    clientID: process.env.LINKEDIN_ID || 'APP_ID',
    clientSecret: process.env.LINKEDIN_SECRET || 'APP_SECRET',
    callbackURL: '/auth/linkedin/callback'
  },
  github: {
    clientID: process.env.GITHUB_ID || 'APP_ID',
    clientSecret: process.env.GITHUB_SECRET || 'APP_SECRET',
    callbackURL: '/auth/github/callback'
  },
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
  newrelic: {
    enabled: process.env.NEWRELIC_ENABLED || false,
    app_name: process.env.NEWRELIC_APP || ['Trustroots'],
    license_key: process.env.NEWRELIC_KEY || 'NEWRELIC_KEY',
    logging_level: process.env.NEWRELIC_LOGGING_LEVEL || 'info',
  },
  GA: {
    code: process.env.GA_CODE || ''
  },
  piwik: {
    enabled: process.env.PIWIK_ENABLED || false,
    url: process.env.PIWIK_URL || '',
    siteId: process.env.PIWIK_ID || ''
=======
    publicKey: process.env.MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoidHJ1c3Ryb290cyIsImEiOiJVWFFGa19BIn0.4e59q4-7e8yvgvcd1jzF4g'
>>>>>>> origin/vertical-modules
  }
};
