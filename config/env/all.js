'use strict';

module.exports = {
	app: {
		title: 'Trustroots',
		description: 'Hospitality exchange community for hitchhikers and other travellers. We want a world that encourages trust, adventure and intercultural connections.',
		keywords: 'traveling,hospitality exchange,hospex,nomadism',
		// These will be pushed PUBLICLY to html as json:
		settings: {
			mapbox: {
				user: process.env.MAPBOX_USERNAME || 'trustroots',
				map: process.env.MAPBOX_MAP || ['k8mokch5', 'ce8bb774', 'kil7hee6'], // default, hitchmap, satellite
				access_token: process.env.MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoidHJ1c3Ryb290cyIsImEiOiJVWFFGa19BIn0.4e59q4-7e8yvgvcd1jzF4g' //Public key
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
	sessionCollection: 'sessions',
	profileMinimumLength: 140 // Require User.profile.description to be >140 chars to send messages
};
