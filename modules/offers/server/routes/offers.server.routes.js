'use strict';

module.exports = function(app) {

  var users = require('../../../users/server/controllers/users.server.controller');
  var offers = require('../controllers/offers.server.controller');

  // Setting up the offers api

    app.route('/api/offers-by/:userId')
      .get(users.requiresLogin, offers.read)
      //.put(users.requiresLogin, offers.hasAuthorization, offers.update)
      .delete(users.requiresLogin, offers.hasAuthorization, offers.delete);

    app.route('/api/offers')
      .get(users.requiresLogin, offers.list)
      .post(users.requiresLogin, offers.create);

    app.route('/api/offers/:offerId')
      .get(users.requiresLogin, offers.read);

  // Finish by binding the middleware
  app.param('userId', offers.offerByUserId);
  app.param('offerId', offers.offerById);
};
