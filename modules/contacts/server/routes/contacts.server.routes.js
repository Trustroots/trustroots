'use strict';

/**
 * Module dependencies.
 */
module.exports = function(app) {

  var path = require('path'),
      //contactsPolicy = require('../policies/contacts.server.policy'),
      contacts = require('../controllers/contacts.server.controller'),
      users = require(path.resolve('./modules/users/server/controllers/users.server.controller'));


  // Contact
  app.route('/api/contact')
    .post(users.requiresLogin, contacts.add);

  app.route('/api/contact-by/:userId')
    .get(users.requiresLogin, contacts.hasAuthorization, contacts.get);

  app.route('/api/contact/:contactId')
    .get(users.requiresLogin, contacts.hasAuthorization, contacts.get)
    .put(users.requiresLogin, contacts.receiverHasAuthorization, contacts.confirm)
    .delete(users.requiresLogin, contacts.hasAuthorization, contacts.remove);

  // Contact list
  app.route('/api/contacts/:listUserId')
    .get(users.requiresLogin, contacts.list);

  // Finish by binding middlewares
  app.param('listUserId', contacts.contactListByUser);
  app.param('contactId', contacts.contactById);
  app.param('userId', contacts.contactByUserId);
};
