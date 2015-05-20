'use strict';

/**
 * Use this file to override /env/*.js configurations.
 * Other files from /config/secret/ folder won't be pushed to the repository.
 */

module.exports = {
  app: {
    title: 'Trustroots',
    description: 'Hospitality exchange community for hitchhikers and other travellers. We want a world that encourages trust, adventure and intercultural connections.',
    tagline: 'Hospitality exchange community for hitchhikers and other travellers.',
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
  https: true,
  domain: 'mikael.pagekite.me',
  sessionSecret: 'MEAN',
  facebook: {
    page: 'https://www.facebook.com/trustroots.org',
    clientID: '474961052659487',
    clientSecret: '97bb2353f333b8aba2735cafd19f2d0a',
    callbackURL: '/auth/facebook/callback'
  },
  twitter: {
    username: 'USERNAME',
    clientID: 'APP_ID',
    clientSecret: 'APP_SECRET',
    callbackURL: '/auth/twitter/callback'
  },
  google: {
    page: 'https://google.com/+TrustrootsOrg',
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
    from: 'mikael+trustroots-dev@ihminen.org',
    options: {
      host: 'smtp._mandrillapp.com',
      port: '587',
      auth: {
        user: 'mikael@ihminen.org',
        pass: 'doCThJsZdG5YafirP0ttrg'
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
  },
  piwik: {
    enabled: false,
    url: 'piwik.trustroots.org',
    siteId: '1'
  }
};
