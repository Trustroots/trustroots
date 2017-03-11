'use strict';

/*
 * Please don't make your own config changes to this file!
 * Copy local.sample.js to local.js and make your changes there. Thanks.
 *
 * Load order:
 * - default.js
 * - {development|production|test}.js
 * - local.js
 *
 * NOTE: Configs are shallow copied (like `_.extend()`), not deeply copied.
 */

module.exports = {
  app: {
    title: 'Trustroots',
    description: 'Travellers community for sharing, hosting and getting people together. We want a world that encourages trust and adventure.'
  },
  // Appears on top of every page for authenticated users.
  // There's no way turning them off permanently,
  // so remember to keep them visible only limited times.
  siteAnnouncement: {
    enabled: false,
    // Can contain HTML
    // You can access user object like this: `{{app.user.displayName}}`
    message: ''
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
  surveyReactivateHosts: 'https://ideas.trustroots.org/?p=1302#page-1302', // Survey to send with host reactivation emails
  profileMinimumLength: 140, // Require User.profile.description to be >=140 chars to send messages
  // Strings not allowed as usernames and tag/tribe labels
  illegalStrings: ['trustroots', 'trust', 'roots', 're', 're:', 'fwd', 'fwd:', 'reply', 'admin', 'administrator', 'password',
                   'username', 'unknown', 'anonymous', 'null', 'undefined', 'home', 'signup', 'signin', 'login', 'user',
                   'edit', 'settings', 'username', 'user', 'demo', 'test', 'support', 'networks', 'profile', 'avatar', 'mini',
                   'photo', 'account', 'api', 'modify', 'feedback', 'security', 'accounts', 'tribe', 'tag', 'community'
                  ],
  // SparkPost webhook API endpoint configuration (`/api/sparkpost/webhook`)
  sparkpostWebhook: {
    enabled: process.env.SPARKPOST_WEBHOOK_ENABLED || true,
    username: process.env.SPARKPOST_WEBHOOK_USERNAME || 'sparkpost',
    password: process.env.SPARKPOST_WEBHOOK_PASSWORD || 'sparkpost'
  },
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
  // Configuration of stathat.
  // www.stathat.com is a tool/service for tracking statistics
  stathat: {
    enabled: false,
    key: ''
  },
  limits: {
    // Messages shorter than this will be tagged 'short' in influxdb,
    // otherwise 'long'
    longMessageMinimumLength: 170,
    // How many signup reminders to send before giving up
    maxSignupReminders: 3,
    // How many signup reminders to process at once
    maxProcessSignupReminders: 50,
    // How long we should wait before trying to reactivate "no" hosts?
    // Moment.js `duration` object literal http://momentjs.com/docs/#/durations/
    timeToReactivateHosts: { days: 90 }
  },
  mailer: {
    from: process.env.MAILER_FROM || 'trustroots@localhost',
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
    user: process.env.MAPBOX_USERNAME || '',
    publicKey: process.env.MAPBOX_ACCESS_TOKEN || ''
  },
  facebook: {
    page: process.env.FACEBOOK_PAGE || '',
    clientID: process.env.FACEBOOK_ID || '',
    clientSecret: process.env.FACEBOOK_SECRET || '',
    callbackURL: '/api/auth/facebook/callback'
  },
  twitter: {
    username: process.env.TWITTER_USERNAME || '',
    clientID: process.env.TWITTER_KEY || '',
    clientSecret: process.env.TWITTER_SECRET || '',
    callbackURL: '/api/auth/twitter/callback'
  },
  google: {
    page: process.env.GOOGLE_PAGE || ''
  },
  github: {
    clientID: process.env.GITHUB_ID || '',
    clientSecret: process.env.GITHUB_SECRET || '',
    callbackURL: '/api/auth/github/callback'
  },
  googleAnalytics: {
    enabled: process.env.GA_ENABLED || false,
    code: process.env.GA_CODE || ''
  },
  log: {
    papertrail: {
      // If host & port are false, papertrail is disabled
      host: process.env.WINSTON_HOST || false,
      port: process.env.WINSTON_PORT || false,
      level: 'debug',
      program: 'production',
      inlineMeta: true
    }
  }
};
