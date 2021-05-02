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
  featureFlags: {
    reference: true,
  },
  app: {
    title: 'Trustroots',
    description:
      'Travellers community for sharing, hosting and getting people together. We want a world that encourages trust and adventure.',
  },

  // Appears on top of every page for authenticated users.
  // There's no way turning them off permanently,
  // so remember to keep them visible only limited times.
  siteAnnouncement: {
    enabled: false,
    // Can contain HTML
    // You can access user object like this: `{{app.user.displayName}}`
    message: '',
  },
  maxUploadSize: 10 * 1024 * 1024, // 10MB. Remember to change this to Nginx configs as well
  imageProcessor: 'graphicsmagick', // graphicsmagick|imagemagick
  uploadTmpDir: './tmp/',
  uploadDir: './public/uploads-profile',
  circleImagesDir: './public/uploads-circle',
  port: 3000,
  host: 'localhost',
  fd: null, // listen on a file descriptor (instead of host/port)
  https: false,
  sessionSecret: 'MEAN',
  sessionCollection: 'sessions',
  domain: 'localhost:3000',
  supportEmail: 'support@trustroots.org', // TO-address for support requests
  supportVolunteerNames: ['Dario', 'Noah'], // Used as "from" name to send some automated emails
  surveyReactivateHosts: 'https://ideas.trustroots.org/?p=1302#page-1302', // Survey to send with host reactivation emails
  profileMinimumLength: 140, // Require User.profile.description to be >=140 chars to send messages
  // Strings not allowed as usernames and tag/tribe labels
  illegalStrings: [
    'account',
    'accounts',
    'admin',
    'administrator',
    'anonymous',
    'api',
    'avatar',
    'circle',
    'community',
    'demo',
    'edit',
    'feedback',
    'fwd:',
    'fwd',
    'home',
    'login',
    'mini',
    'moderator',
    'modify',
    'networks',
    'null',
    'official',
    'password',
    'photo',
    'profile',
    're:',
    're',
    'remove',
    'reply',
    'roots',
    'security',
    'settings',
    'signin',
    'signup',
    'support',
    'tag',
    'test',
    'tribe',
    'trust',
    'trustroots',
    'undefined',
    'unknown',
    'user',
    'user',
    'username',
    'username',
  ],
  // SparkPost webhook API endpoint configuration (`/api/sparkpost/webhook`)
  sparkpostWebhook: {
    enabled: true,
    username: 'sparkpost',
    password: 'sparkpost',
  },
  influxdb: {
    enabled: false,
    options: {
      host: 'localhost',
      port: 8086, // default 8086
      protocol: 'http', // default 'http'
      // username: '',
      // password: '',
      database: 'trustroots',
    },
  },
  // Configuration of stathat.
  // www.stathat.com is a tool/service for tracking statistics
  stathat: {
    enabled: false,
    key: '',
  },
  limits: {
    // Maximum length for public feedback for an experience
    maximumExperienceFeedbackPublicLength: 2000,
    // Messages shorter than this will be tagged 'short' in influxdb,
    // otherwise 'long'
    longMessageMinimumLength: 170,
    // How many signup reminders to send before giving up
    maxSignupReminders: 3,
    // How many signup reminders to process at once
    maxProcessSignupReminders: 50,
    // How long we should wait before trying to reactivate "no" hosts?
    // Moment.js `duration` object literal http://momentjs.com/docs/#/durations/
    timeToReactivateHosts: { days: 90 },
    // How long should user have for replying an experience before it becomes public?
    timeToReplyExperience: { days: 14 },
    // How long should we wait to update user's seen field since the last update
    timeToUpdateLastSeenUser: { minutes: 5 },
    // when to send reminders about unread messages (since the last unread message was sent)
    // the maximum amount of reminders to send is defined by length of the array
    unreadMessageReminders: [{ minutes: 10 }, { hours: 24 }],
    // after what delay to stop sending further unread message reminders
    unreadMessageRemindersTooLate: { days: 14 },
    // pagination: how many results should we return per page
    paginationLimit: 20,
    // Time intervals between welcome sequence emails
    welcomeSequence: {
      first: { minutes: 0 },
      second: { hours: 24 },
      third: { days: 14 },
    },
    // Up to how many days in future can meet offers be visible
    maxOfferValidFromNow: { days: 30 },
  },
  mailer: {
    from: 'trustroots@localhost',
    options: {
      service: false,
      auth: {
        user: false,
        pass: false,
      },
    },
  },
  // Mapbox is publicly exposed to the frontend
  mapbox: {
    maps: {
      streets: {
        map: 'streets-v9',
        user: 'mapbox',
        legacy: false,
      },
      satellite: {
        map: 'satellite-streets-v9',
        user: 'mapbox',
        legacy: false,
      },
      outdoors: {
        map: 'outdoors-v9',
        user: 'mapbox',
        legacy: false,
      },
    },
    user: '',
    publicKey: '',
  },
  facebook: {
    page: '',
    clientID: false,
    clientSecret: false,
    clientAccessToken: false,
    callbackURL: '/api/auth/facebook/callback',
    notificationsEnabled: false,
  },
  twitter: {
    username: '',
    clientID: '',
    clientSecret: '',
    callbackURL: '/api/auth/twitter/callback',
  },
  google: {
    page: '',
  },
  fcm: {
    senderId: '',
    serviceAccount: false,
  },
  github: {
    clientID: '',
    clientSecret: '',
    callbackURL: '/api/auth/github/callback',
  },
  googleAnalytics: {
    enabled: false,
    code: '',
  },
  log: {
    papertrail: {
      // If host & port are false, papertrail is disabled
      host: false,
      port: false,
      level: 'debug',
      program: 'production',
      inlineMeta: true,
    },
  },
  sentry: {
    enabled: false,
    options: {
      dsn: '',
      // Note: integrations are defined directly at `Sentry.init()`, don't add them here.
    },
  },
  // Webpack bundle analyzer
  // Visualize size of webpack output files with an interactive zoomable treemap.
  // https://www.npmjs.com/package/webpack-bundle-analyzer
  bundleAnalyzer: {
    enabled: false,
    // See https://github.com/webpack-contrib/webpack-bundle-analyzer#options-for-plugin
    options: {},
  },
};
