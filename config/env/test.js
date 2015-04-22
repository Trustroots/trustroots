'use strict';

/*
 * Please don't make your own config changes to ./env/* files!
 * Copy ./private/_template.js to ./private/{development|production|test}.js
 * and make your changes there. Thanks.
 */

module.exports = {
  db: {
    uri: 'mongodb://localhost/trust-roots-test',
    options: {
      user: '',
      pass: ''
    }
  },
  port: 3001,
  app: {
    title: 'Trustroots test environment.',
    description: 'Trustroots test environment.',
    tagline: 'Trustroots test environment.'
  },
	mapbox: {
		// Mapbox is publicly exposed to the frontend
		user: process.env.MAPBOX_USERNAME || 'trustroots',
		map: {
			default: process.env.MAPBOX_MAP_DEFAULT || false,
			satellite: process.env.MAPBOX_MAP_SATELLITE || false,
			hitchmap: process.env.MAPBOX_MAP_HITCHMAP || false
		},
		publicKey: process.env.MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoidHJ1c3Ryb290cyIsImEiOiJVWFFGa19BIn0.4e59q4-7e8yvgvcd1jzF4g'
	}
};
