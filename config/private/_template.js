'use strict';

module.exports = {

  // Copy this file to {development|production|test}.js
  // and put your private config modifications there.
  // Only _template.js is pushed to repo from this folder.

  // See https://github.com/andris9/Nodemailer#tldr-usage-example how to configure mailer
  // In production we're using Mandrill https://mandrillapp.com
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
  sessionSecret: 'MEAN',
	mapbox: {
		// Mapbox is publicly exposed to the frontend
		user: 'trustroots',
		map: {
			default: 'k8mokch5',
			satellite: 'kil7hee6',
			hitchmap: 'ce8bb774'
		},
		publicKey: 'pk.eyJ1IjoidHJ1c3Ryb290cyIsImEiOiJVWFFGa19BIn0.4e59q4-7e8yvgvcd1jzF4g'
	},
  facebook: {
    clientID: 'APP_ID',
    clientSecret: 'APP_SECRET',
    callbackURL: '/api/auth/facebook/callback'
  },
  twitter: {
    username: 'trustroots',
    clientID: 'APP_ID',
    clientSecret: 'APP_SECRET',
    callbackURL: '/api/auth/twitter/callback'
  },
  google: {
    clientID: 'APP_ID',
    clientSecret: 'APP_SECRET',
    callbackURL: '/api/auth/google/callback'
  },
  linkedin: {
    clientID: 'APP_ID',
    clientSecret: 'APP_SECRET',
    callbackURL: '/api/auth/linkedin/callback'
  },
  github: {
    clientID: 'APP_ID',
    clientSecret: 'APP_SECRET',
    callbackURL: '/api/auth/github/callback'
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
    url: 'PIWIK_URL',
    siteId: 'PIWIK_ID'
  }

};
