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
  app: {
    title: 'Trustroots',
    description: 'Travellers community for sharing, hosting and getting people together. We want a world that encourages trust and adventure.'
  },
  maxUploadSize: process.env.MAX_UPLOAD_SIZE || 10 * 1024 * 1024, // 10MB. Remember to change this to Nginx configs as well
  imageProcessor: 'graphicsmagick', // graphicsmagick|imagemagick
  uploadTmpDir: './tmp/',
  uploadDir: './modules/users/client/img/profile/uploads/',
  port: process.env.PORT || 3000,
  https: process.env.HTTPS || false,
  sessionSecret: 'MEAN',
  sessionCollection: 'sessions',
  domain: process.env.DOMAIN || 'localhost:3000',
  supportEmail: 'support@trustroots.org', // TO-address for support requests
  profileMinimumLength: 140, // Require User.profile.description to be >=140 chars to send messages
  // Strings not allowed as usernames and tag/tribe labels
  illegalStrings: ['trustroots', 'trust', 'roots', 're', 're:', 'fwd', 'fwd:', 'reply', 'admin', 'administrator', 'password',
                   'username', 'unknown', 'anonymous', 'null', 'undefined', 'home', 'signup', 'signin', 'login', 'user',
                   'edit', 'settings', 'username', 'user', ' demo', 'test', 'support', 'networks', 'profile', 'avatar', 'mini',
                   'photo', 'account', 'api', 'modify', 'feedback', 'security', 'accounts', 'tribe', 'tag', 'community'
                  ],
  influxdb: {
    enabled: false,
    options: {
      host: 'localhost',
      port: 8086, // default 8086
      protocol: 'http', // default 'http'
      // username: '',
      // password: '',
      database: 'trustroots'
    }
  },
  limits: {
    // Messages shorter than this will be tagged 'short' in influxdb,
    // otherwise 'long'
    longMessageMinimumLength: 170,
    // How many signup reminders to send before giving up
    maxSignupReminders: 3,
    // How many signup reminders to process at once
    maxProcessSignupReminders: 50
  },
  mailer: {
    from: process.env.MAILER_FROM || 'hello@trustroots.org',
    options: {
      service: process.env.MAILER_SERVICE_PROVIDER || false,
      auth: {
        user: process.env.MAILER_EMAIL_ID || false,
        pass: process.env.MAILER_PASSWORD || false
      }
    }
  },
  // Mapbox is publicly exposed to the frontend
  mapbox: {
    maps: {
      streets: {
        map: 'streets-v9',
        user: 'mapbox',
        legacy: false
      },
      satellite: {
        map: 'satellite-streets-v9',
        user: 'mapbox',
        legacy: false
      },
      outdoors: {
        map: 'outdoors-v9',
        user: 'mapbox',
        legacy: false
      }
    },
    user: process.env.MAPBOX_USERNAME || false,
    publicKey: process.env.MAPBOX_ACCESS_TOKEN || false
  },
  facebook: {
    page: process.env.FACEBOOK_PAGE || '',
    clientID: process.env.FACEBOOK_ID || 'APP_ID',
    clientSecret: process.env.FACEBOOK_SECRET || 'APP_SECRET',
    callbackURL: '/api/auth/facebook/callback'
  },
  twitter: {
    username: process.env.TWITTER_USERNAME || 'USERNAME',
    clientID: process.env.TWITTER_KEY || 'CONSUMER_KEY',
    clientSecret: process.env.TWITTER_SECRET || 'CONSUMER_SECRET',
    callbackURL: '/api/auth/twitter/callback'
  },
  google: {
    page: process.env.GOOGLE_PAGE || ''
  },
  github: {
    clientID: process.env.GITHUB_ID || 'APP_ID',
    clientSecret: process.env.GITHUB_SECRET || 'APP_SECRET',
    callbackURL: '/api/auth/github/callback'
  },
  googleAnalytics: {
    enabled: process.env.GA_ENABLED || false,
    code: process.env.GA_CODE || ''
  }
};
