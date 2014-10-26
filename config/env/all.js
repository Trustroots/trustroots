'use strict';

module.exports = {
	app: {
		title: 'Trustroots',
		description: 'Enabling the latent trust between humans. Meet and host other travellers.',
		keywords: 'traveling,hospitality exchange,hospex,nomadism',
		userMiniProfileFields: ['id', 'displayName', 'username', 'avatarSource', 'emailHash', 'languages'],

		// These will be pushed PUBLICLY to html as json:
		settings: {
			mapbox: {
				user: 'bikeshed',
				map: 'hn2ghak7'
			},
			geonames: {
				username: 'trustroots'
			},
			osm: {
				email: ['maps','@','trustroots','.org'].join('') // spam bot prevention...
			}
		}

	},
	port: process.env.PORT || 3000,
	templateEngine: 'swig',
	sessionSecret: 'MEAN',
	sessionCollection: 'sessions',
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
			    'public/lib/perfect-scrollbar/src/perfect-scrollbar.css',
					'public/lib/select2/select2.css',
					'public/lib/angular-ui-select/dist/select.css',
					'public/lib/leaflet/dist/leaflet.css',
					'public/lib/leaflet.markercluster/dist/MarkerCluster.css'
			],
			js: [
				'public/lib/jquery/dist/jquery.js',
				'public/lib/angular/angular.js',
				'public/lib/angular-resource/angular-resource.js',
				'public/lib/angular-animate/angular-animate.js',
				'public/lib/angular-touch/angular-touch.js',
				'public/lib/angular-sanitize/angular-sanitize.js',
				'public/lib/angular-ui-router/release/angular-ui-router.js',
				'public/lib/angular-ui-utils/ui-utils.js',
				'public/lib/angular-ui-select/dist/select.js',
				'public/lib/select2/select2.js',
				'public/lib/angular-bootstrap/ui-bootstrap-tpls.js',
				'public/lib/moment/moment.js',
				'public/lib/angular-moment/angular-moment.js',
				'public/lib/medium-editor/dist/js/medium-editor.js',
				'public/lib/angular-medium-editor/dist/angular-medium-editor.js',
				'public/lib/angular-socket-io/socket.js',
				'public/lib/perfect-scrollbar/src/jquery.mousewheel.js', // @todo: is this really needed?
				'public/lib/perfect-scrollbar/src/perfect-scrollbar.js',
				'public/lib/angular-perfect-scrollbar/src/angular-perfect-scrollbar.js',
				'public/lib/leaflet/dist/leaflet-src.js',
				'public/lib/leaflet.markercluster/dist/leaflet.markercluster-src.js',
				'public/lib/angular-leaflet-directive/dist/angular-leaflet-directive.js',
				'public/lib/ngGeolocation/ngGeolocation.js',
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
		],
		tests: [
			'public/lib/angular-mocks/angular-mocks.js',
			'public/modules/*/tests/*.js'
		]
	}
};
