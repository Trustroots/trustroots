'use strict';

module.exports = {
	app: {
		title: 'Trustroots',
		description: 'Enabling the latent trust between humans. Meet and host other travellers.',
		keywords: 'traveling,hospitality exchange,hospex,nomadism',
		// These will be pushed PUBLICLY to html as json:
		settings: {
			mapbox: {
				user: process.env.MAPBOX_USERNAME || 'trustroots',
				map: process.env.MAPBOX_MAP || ['k8mokch5', 'ce8bb774'],
				access_token: process.env.MAPBOX_SECRET_KEY || 'MAPBOX_SECRET_KEY'
			},
			osm: {
				email: process.env.OSM_EMAIL || ['maps','@','trustroots','.org'].join('') // spam bot prevention...
			}
		}
	},
	port: process.env.PORT || 3000,
	https: process.env.HTTPS || false,
	templateEngine: 'swig',
	sessionSecret: process.env.SESSION_SECRET || 'MEAN',
	sessionCollection: 'sessions'
};
