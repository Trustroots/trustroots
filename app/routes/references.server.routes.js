'use strict';

module.exports = function(app) {
	var users = require('../../app/controllers/users');
	var references = require('../../app/controllers/references');

	// References Routes
	app.route('/references')
		.get(references.list)
		.post(users.requiresLogin, references.create);

	app.route('/references/:referenceId')
		.get(references.read)
		.put(users.requiresLogin, references.hasAuthorization, references.update)
		.delete(users.requiresLogin, references.hasAuthorization, references.delete);

	// Finish by binding the Reference middleware
	app.param('referenceId', references.referenceByID);
};