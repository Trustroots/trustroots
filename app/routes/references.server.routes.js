'use strict';

module.exports = function(app) {
  var users = require('../../app/controllers/users');
  var references = require('../../app/controllers/references');

  // References Routes
    app.route('/references-by/:userId')
      .get(users.requiresLogin, references.list);

  app.route('/references')
    .post(users.requiresLogin, references.create);

  app.route('/references/:referenceId')
    .get(users.requiresLogin, references.read)
    .put(users.requiresLogin, references.hasAuthorization, references.update)
    .delete(users.requiresLogin, references.hasAuthorization, references.delete);

  // Finish by binding the Reference middleware
  app.param('userId', references.referencesByUser);
  app.param('referenceId', references.referenceByID);
};
