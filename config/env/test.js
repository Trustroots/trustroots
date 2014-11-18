'use strict';

module.exports = {
	db: 'mongodb://localhost/trust-roots-test',
	port: 3001,
	app: {
		title: 'Trustroots - Test Environment'
  },
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
  			'public/lib/angular-masonry/angular-masonry.js',
  			'public/lib/masonry/dist/masonry.pkgd.min.js',
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
	}
};
