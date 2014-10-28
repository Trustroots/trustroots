'use strict';

/**
 * Use this file to override /env/*.js configurations.
 * Other files from /config/secret/ folder won't be pushed to the repository.
 */

module.exports = {
  app: {
    // These will be pushed PUBLICLY to html as json:
    settings: {
      mapbox: {
        user: 'USERNAME',
        map: 'MAP_ID'
      },
      geonames: {
        username: 'USERNAME'
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
  }
};
