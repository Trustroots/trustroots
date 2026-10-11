// Worker overrides are test-only and may never name an application database.
const workerDatabase =
  process.env.NODE_ENV === 'test'
    ? process.env.TRUSTROOTS_SERVER_TEST_DATABASE
    : undefined;
if (
  workerDatabase !== undefined &&
  !/^trustroots-test-worker-[a-f0-9]{12}-[1-8]$/.test(workerDatabase)
) {
  throw new Error('Invalid TRUSTROOTS_SERVER_TEST_DATABASE.');
}

let service = {};
/*
 * Please don't make your own config changes to this file!
 * Copy local.sample.js to local.js and make your changes there. Thanks.
 *
 * Load order:
 * - default.js
 * - {development|production|test}.js
 * - local.js
 */

service = {
  // Test-only VAPID pair. Production keys must be supplied through environment variables.
  webPush: {
    publicKey:
      'BNPRQG83KHuc4ZkSKlmSKQWC3PQm2YD-yOiPdjFbQyB8VM6ZZSLD2caRpXad6G_2qXqb_WUz7V2T7w1KqAXbslQ',
    privateKey: 'dhrEzewvJiOg7Q0oC5goPiL6TUiAItTMMqhu8-u1qcw',
    subject: 'mailto:push-test@example.org',
    allowedHosts: ['ntfy.sh'],
  },
  targetedRequestLimits: {
    signin: { windowMs: 60 * 60 * 1000, ipLimit: 10000, identityLimit: 10000 },
    forgotPassword: {
      windowMs: 60 * 60 * 1000,
      ipLimit: 10000,
      identityLimit: 10000,
    },
    resetPassword: {
      windowMs: 60 * 60 * 1000,
      ipLimit: 10000,
      identityLimit: 10000,
    },
    resendConfirmation: {
      windowMs: 60 * 60 * 1000,
      ipLimit: 10000,
      identityLimit: 10000,
    },
    manageSessions: {
      windowMs: 60 * 60 * 1000,
      ipLimit: 10000,
      identityLimit: 10000,
    },
    avatarUpload: {
      windowMs: 60 * 60 * 1000,
      ipLimit: 10000,
      identityLimit: 10000,
    },
  },
  featureFlags: {
    reference: true,
  },
  db: {
    uri:
      'mongodb://' +
      (process.env.DB_1_PORT_27017_TCP_ADDR || 'localhost') +
      '/' +
      (workerDatabase || 'trustroots-test'),
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
    // Indexes are built once per test run in scripts/test-server.js.
    autoIndex: false,
    // Check for MongoDB version compatibility on start
    checkCompatibility: false,
  },
  maxUploadSize: 10000,
  // =10kb in bytes. Set ridiculously small just for tests
  host: process.env.TRUSTROOTS_E2E_HOST || 'localhost',
  port: Number(process.env.PORT) || 3001,
  csrfAllowedOrigins: [
    `http://localhost:${process.env.TRUSTROOTS_E2E_WEB_PORT || 4300}`,
    `http://localhost:${
      process.env.TRUSTROOTS_E2E_API_PORT || process.env.PORT || 4301
    }`,
    `http://127.0.0.1:${process.env.TRUSTROOTS_E2E_WEB_PORT || 4300}`,
    `http://127.0.0.1:${
      process.env.TRUSTROOTS_E2E_API_PORT || process.env.PORT || 4301
    }`,
  ],
  // Subset of `default.js` illegalStrings for route tests. The full production
  // list lives in default.js; extend this when adding reserved names that need
  // explicit signup/profile test coverage.
  illegalStrings: [
    'trustroots',
    'trust',
    'roots',
    'nostr',
    'npub',
    'nsec',
    'nip05',
    'relay',
    'about',
    'contact',
    'faq',
    'foundation',
    'privacy',
    'rules',
    'team',
    'help',
    'abuse',
    'safety',
    'legal',
    'staff',
    'media',
    'volunteering',
    'contribute',
    'statistics',
    'search',
    'messages',
    'inbox',
    'offer',
    'offers',
    'hosting',
    'contacts',
  ],
  app: {
    title: 'Trustroots test environment.',
    description: 'Trustroots test environment.',
  },
  umami: {
    scriptSrc: 'https://1p.trustroots.org/script.js',
    websiteId: '6c518160-cd10-4233-a3e4-4491ee387a01',
  },
  influxdb: {
    enabled: process.env.TRUSTROOTS_TEST_STATS_OUTAGE === 'true',
    options: {
      host: '127.0.0.1',
      port: 1,
      protocol: 'http',
      database: 'trustroots-test',
    },
  },
  mapbox: {
    // Mapbox is publicly exposed to the frontend
    user: 'trustroots',
    map: {
      default: false,
      satellite: false,
      hitchmap: false,
    },
    publicKey:
      'pk.eyJ1IjoidHJ1c3Ryb290cyIsImEiOiJVWFFGa19BIn0.4e59q4-7e8yvgvcd1jzF4g',
  },
};
export default service;
export { service as 'module.exports' };
