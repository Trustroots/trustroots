'use strict';

/**
 * Use this file to override /env/*.js configurations.
 * Other files from /config/secret/ folder won't be pushed to the repository.
 */

module.exports = {
  app: {
    title: 'Trustroots',
    // These will be pushed PUBLICLY to html as json:
    settings: {
      mapbox: {
        user: 'trustroots',
        map: ['k8mokch5', 'ce8bb774'],
        access_token: 'MAPBOX_PUBLIC_KEY'
      },
      osm: {
        email: 'EMAIL'
      }
    }
  },
  sessionSecret: 'MEAN',
  facebook: {
    clientID: 'APP_ID',
    clientSecret: 'APP_SECRET',
    callbackURL: '/auth/facebook/callback'
  },
  twitter: {
    clientID: 'APP_ID',
    clientSecret: 'APP_SECRET',
    callbackURL: '/auth/twitter/callback'
  },
  google: {
    clientID: 'APP_ID',
    clientSecret: 'APP_SECRET',
    callbackURL: '/auth/google/callback'
  },
  linkedin: {
    clientID: 'APP_ID',
    clientSecret: 'APP_SECRET',
    callbackURL: '/auth/linkedin/callback'
  },
  github: {
    clientID: 'APP_ID',
    clientSecret: 'APP_SECRET',
    callbackURL: '/auth/github/callback'
  },
  mailer: {
    from: 'MAILER_FROM',
    options: {
      service: 'MAILER_SERVICE_PROVIDER',
      auth: {
        user: 'MAILER_EMAIL_ID',
        pass: 'MAILER_PASSWORD'
      }
    }
  },
  newrelic: {
    app_name: ['Trustroots'],
    license_key: 'NEWRELIC_KEY',
    logging_level: 'info'
  },
  GA: {
    code: ''
  }
};
