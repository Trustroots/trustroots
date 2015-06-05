'use strict';

/**
 * Module dependencies.
 */
var contactsPolicy = require('../policies/contacts.server.policy'),
    contacts = require('../controllers/contacts.server.controller');

module.exports = function(app) {

  app.route('/api/contact').all(contactsPolicy.isAllowed)
    .post(contacts.add);

  app.route('/api/contact-by/:userId').all(contactsPolicy.isAllowed)
    .get(contacts.get); //contacts.hasAuthorization,

  app.route('/api/contact/:contactId').all(contactsPolicy.isAllowed)
    .get(contacts.get) //contacts.hasAuthorization,
    .put(contacts.confirm) //contacts.receiverHasAuthorization,
    .delete(contacts.remove); //contacts.hasAuthorization,

  // Contact list
  app.route('/api/contacts/:listUserId').all(contactsPolicy.isAllowed)
    .get(contacts.list);

  // Finish by binding middlewares
  app.param('listUserId', contacts.contactListByUser);
  app.param('contactId', contacts.contactById);
  app.param('userId', contacts.contactByUserId);
};
