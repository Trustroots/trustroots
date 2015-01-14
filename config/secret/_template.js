'use strict';

/**
 * Use this file to override /env/*.js configurations.
 * Other files from /config/secret/ folder won't be pushed to the repository.
 */

module.exports = {
  app: {
    title: 'Trustroots',
    description: 'Hospitality exchange community for hitchhikers and other travellers.',
    // These will be pushed PUBLICLY to html as json:
    settings: {
      mapbox: {
        user: 'trustroots',
        map: ['k8mokch5', 'ce8bb774', 'kil7hee6'], // default, hitchmap, satellite
        access_token: 'pk.eyJ1IjoidHJ1c3Ryb290cyIsImEiOiJVWFFGa19BIn0.4e59q4-7e8yvgvcd1jzF4g' //Public key
      },
      osm: {
        email: ['maps','@','trustroots','.org'].join('') // spam bot prevention since this ends up to repository...
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
    enabled: false,
    app_name: ['Trustroots'],
    license_key: 'NEWRELIC_KEY',
    logging_level: 'info'
  },
  GA: {
    code: ''
  }
};
