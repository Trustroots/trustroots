'use strict';

module.exports = function(app) {

	var users = require('../../app/controllers/users');
	var offers = require('../../app/controllers/offers');

	// Setting up the offers api

		app.route('/offers')
			.get(users.requiresLogin, offers.list)
			.post(users.requiresLogin, offers.create);

		app.route('/offers/:userId')
			.get(users.requiresLogin, offers.read)
			//.put(users.requiresLogin, offers.hasAuthorization, offers.update)
			.delete(users.requiresLogin, offers.hasAuthorization, offers.delete);

	// Finish by binding the middleware
	app.param('userId', offers.offerByUserID);
};
