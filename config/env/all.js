'use strict';

module.exports = {
	app: {
		title: 'Trust Roots',
		description: 'Travellers network',
		keywords: 'traveling,hospitality exchange,nomadism',
		miniUserProfileFields: ['id', 'displayName', 'username', 'avatarSource', 'emailHash']
	},
	port: process.env.PORT || 3000,
	templateEngine: 'swig',
	sessionSecret: 'MEAN',
	sessionCollection: 'sessions',
	assets: {
		lib: {
		    //less: [
			//	'public/lib/bootstrap/less/bootstrap.less',
			//	'public/lib/fontawesome/less/font-awesome.less',
			//	'public/modules/variables.less',
			//	'public/modules/app.less'
		    //],
			css: [
			    'public/lib/medium-editor/dist/css/medium-editor.css',
			    'public/lib/perfect-scrollbar/src/perfect-scrollbar.css',
					'public/lib/select2/select2.css',
					'public/lib/angular-ui-select/dist/select.css'
			],
			js: [
				'public/lib/jquery/dist/jquery.js',
				'public/lib/angular/angular.js',
				'public/lib/angular-resource/angular-resource.js',
				'public/lib/angular-cookies/angular-cookies.js',
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
			]
		},
        less: [
        	'public/modules/**/less/*.less'
        ],
        css: [
            // nada
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
