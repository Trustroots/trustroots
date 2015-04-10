'use strict';

module.exports = {
  db: 'mongodb://localhost/trust-roots-dev',
  app: {
    title: 'Trustroots - Development Environment',
    description: 'This is a test version, please go to Trustroots.org for the real one.',
    // Settings will be pushed PUBLICLY to templates as json, no secrets:
    settings: {
      mapbox: {
        user: process.env.MAPBOX_USERNAME || 'trustroots',
        map: process.env.MAPBOX_MAP || ['k8mokch5', 'ce8bb774', 'kil7hee6'], // default, hitchmap, satellite
        access_token: process.env.MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoidHJ1c3Ryb290cyIsImEiOiJVWFFGa19BIn0.4e59q4-7e8yvgvcd1jzF4g' //Public key
      },
      osm: {
        email: process.env.OSM_EMAIL || ['maps','@','trustroots','.org'].join('') // spam bot prevention since this ends up to repository...
      }
    }
  },
  domain: process.env.DOMAIN || 'localhost:3000',
  assets: {
    lib: {
        //less: [
        //  'public/lib/bootstrap/less/bootstrap.less',
        //  'public/lib/fontawesome/less/font-awesome.less',
        //  'public/modules/variables.less',
        //  'public/modules/app.less'
        //],
      css: [
          'public/lib/medium-editor/dist/css/medium-editor.css',
          'public/lib/leaflet/dist/leaflet.css',
          //'public/lib/chosen/chosen.css',
          'public/lib/angular-chosen-localytics/chosen-spinner.css'
      ],
      js: [
        // Non minified  versions
        'public/lib/jquery/dist/jquery.js',
        'public/lib/angular/angular.js',
        'public/lib/angular-resource/angular-resource.js',
        'public/lib/angular-animate/angular-animate.js',
        'public/lib/angular-touch/angular-touch.js',
        'public/lib/angular-sanitize/angular-sanitize.js',
        'public/lib/angular-ui-router/release/angular-ui-router.js',
        'public/lib/angular-ui-utils/ui-utils.js',
        'public/lib/angular-bootstrap/ui-bootstrap-tpls.js',
        'public/lib/moment/moment.js',
        'public/lib/angular-moment/angular-moment.js',
        'public/lib/medium-editor/dist/js/medium-editor.js',
        'public/lib/angular-medium-editor/dist/angular-medium-editor.js',
        //'public/lib/angular-socket-io/socket.js',
        'public/lib/perfect-scrollbar/js/perfect-scrollbar.jquery.js',
        'public/lib/angular-perfect-scrollbar/src/angular-perfect-scrollbar.js',
        'public/lib/leaflet/dist/leaflet-src.js',
        'public/lib/PruneCluster/dist/PruneCluster.js',
        'public/lib/angular-leaflet-directive/dist/angular-leaflet-directive.js',
        'public/lib/angular-deckgrid/angular-deckgrid.js',
        'public/lib/angular-waypoints/dist/angular-waypoints.all.js',
        'public/lib/ng-file-upload/angular-file-upload.js',
        'public/lib/message-center/message-center.js',
        'public/lib/chosen/chosen.jquery.js',
        'public/lib/angular-chosen-localytics/chosen.js',
      ]
    },
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
    ],
    tests: [
      'public/lib/angular-mocks/angular-mocks.js',
      'public/modules/*/tests/*.js'
    ]
  },
  facebook: {
    clientID: process.env.FACEBOOK_ID || 'APP_ID',
    clientSecret: process.env.FACEBOOK_SECRET || 'APP_SECRET',
    callbackURL: '/auth/facebook/callback'
  },
  twitter: {
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
  }
};
