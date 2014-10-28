'use strict';

module.exports = {
	app: {
		title: 'Trustroots',
		description: 'Enabling the latent trust between humans. Meet and host other travellers.',
		keywords: 'traveling,hospitality exchange,hospex,nomadism',
		// These will be pushed PUBLICLY to html as json:
		settings: {
			mapbox: {
				user: process.env.MAPBOX_USER || 'bikeshed',
				map: process.env.MAPBOX_MAP || 'hn2ghak7'
			},
			geonames: {
				username: process.env.GEONAMES_USERNAME || 'trustroots'
			},
			osm: {
				email: process.env.OSM_EMAIL || ['maps','@','trustroots','.org'].join('') // spam bot prevention...
			}
		}
	},
	port: process.env.PORT || 3000,
	templateEngine: 'swig',
	sessionSecret: process.env.SESSION_SECRET || 'MEAN',
	sessionCollection: 'sessions'
};
