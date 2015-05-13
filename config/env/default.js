'use strict';

/*
 * Please don't make your own config changes to ./env/* files!
 * Copy ./private/_template.js to ./private/{development|production|test}.js
 * and make your changes there. Thanks.
 */

module.exports = {
  app: {
    title: 'Trustroots',
    description: 'Travellers community for sharing, hosting and getting people together. Built with hitchhikers in mind. A world that encourages trust and adventure.',
    tagline: 'Hospitality exchange community for hitchhikers and other travellers.'
  },
  port: process.env.PORT || 3000,
  https: process.env.HTTPS || false,
  sessionSecret: 'MEAN',
  sessionCollection: 'sessions',
  domain: process.env.DOMAIN || 'localhost:3000',
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
  mapbox: {
    // Mapbox is publicly exposed to the frontend
    user: process.env.MAPBOX_USERNAME || 'trustroots',
    map: {
      default: process.env.MAPBOX_MAP_DEFAULT || 'k8mokch5',
      satellite: process.env.MAPBOX_MAP_SATELLITE || 'kil7hee6',
      hitchmap: process.env.MAPBOX_MAP_HITCHMAP || 'ce8bb774'
    },
    publicKey: process.env.MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoidHJ1c3Ryb290cyIsImEiOiJVWFFGa19BIn0.4e59q4-7e8yvgvcd1jzF4g'
  },
  facebook: {
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
    url: process.env.PIWIK_URL || 'PIWIK_URL',
    siteId: process.env.PIWIK_ID || 'PIWIK_ID'
  }
};
