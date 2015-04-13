'use strict';

/**
 * Module dependencies.
 */
var users = require('../../app/controllers/users'),
    contacts = require('../../app/controllers/contacts');

module.exports = function(app) {

  // Contact
  app.route('/contact')
    .post(users.requiresLogin, contacts.add);

  app.route('/contact-by/:userId')
    .get(users.requiresLogin, contacts.hasAuthorization, contacts.get);

  app.route('/contact/:contactId')
    .get(users.requiresLogin, contacts.hasAuthorization, contacts.get)
    .put(users.requiresLogin, contacts.receiverHasAuthorization, contacts.confirm)
    .delete(users.requiresLogin, contacts.hasAuthorization, contacts.remove);

  // Contact list
  app.route('/contacts/:listUserId')
    .get(users.requiresLogin, contacts.list);

  // Finish by binding middlewares
  app.param('listUserId', contacts.contactListByUser);
  app.param('contactId', contacts.contactById);
  app.param('userId', contacts.contactByUserId);
};
