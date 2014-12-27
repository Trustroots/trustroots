'use strict';

module.exports = {
  db: process.env.MONGOHQ_URL || process.env.MONGOLAB_URI || 'mongodb://' + (process.env.DB_1_PORT_27017_TCP_ADDR || 'localhost') + '/trust-roots',
  app: {
    title: 'Trustroots',
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
  domain: process.env.DOMAIN || 'www.trustroots.org',
  assets: {
    lib: {
      css: [
          'public/lib/medium-editor/dist/css/medium-editor.css',
          'public/lib/perfect-scrollbar/src/perfect-scrollbar.css',
          'public/lib/leaflet/dist/leaflet.css',
          'public/lib/leaflet.markercluster/dist/MarkerCluster.css'
      ],
      js: [
        // Minified versions
        'public/lib/jquery/dist/jquery.min.js',
        'public/lib/angular/angular.min.js',
        'public/lib/angular-resource/angular-resource.min.js',
        'public/lib/angular-animate/angular-animate.min.js',
        'public/lib/angular-touch/angular-touch.min.js',
        'public/lib/angular-sanitize/angular-sanitize.min.js',
        'public/lib/angular-ui-router/release/angular-ui-router.min.js',
        'public/lib/angular-ui-utils/ui-utils.min.js',
        'public/lib/angular-ui-select/dist/select.min.js',
        'public/lib/angular-bootstrap/ui-bootstrap-tpls.min.js',
        'public/lib/moment/min/moment.min.js',
        'public/lib/angular-moment/angular-moment.min.js',
        'public/lib/medium-editor/dist/js/medium-editor.min.js',
        'public/lib/angular-medium-editor/dist/angular-medium-editor.min.js',
        'public/lib/angular-socket-io/socket.min.js',
        'public/lib/perfect-scrollbar/min/jquery.mousewheel.min.js', // @todo: is this really needed?
        'public/lib/perfect-scrollbar/min/perfect-scrollbar.min.js',
        'public/lib/angular-perfect-scrollbar/src/angular-perfect-scrollbar.js',
        'public/lib/leaflet/dist/leaflet.js',
        'public/lib/leaflet.markercluster/dist/leaflet.markercluster.js',
        'public/lib/angular-leaflet-directive/dist/angular-leaflet-directive.min.js',
        'public/lib/ngGeolocation/ngGeolocation.min.js',
        'public/lib/masonry/dist/masonry.pkgd.min.js',
        'public/lib/imagesloaded/imagesloaded.pkgd.min.js',
        'public/lib/angular-masonry/angular-masonry.js',
        'public/lib/angular-waypoints/dist/angular-waypoints.all.min.js',
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
    app_name: process.env.NEWRELIC_APP || ['Trustroots'],
    license_key: process.env.NEWRELIC_KEY || 'NEWRELIC_KEY',
    logging_level: process.env.NEWRELIC_LOGGING_LEVEL || 'info',
  },
  GA: {
    code: process.env.GA_CODE || ''
  }
};
