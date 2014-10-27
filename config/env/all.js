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
	sessionSecret: process.env.SESSION_SECRET || 'MEAN',
	sessionCollection: 'sessions'
};
