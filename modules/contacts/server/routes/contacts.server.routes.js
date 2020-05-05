/**
 * Module dependencies.
 */
const contactsPolicy = require('../policies/contacts.server.policy');
const contacts = require('../controllers/contacts.server.controller');

module.exports = function (app) {
  app.route('/api/contact').all(contactsPolicy.isAllowed).post(contacts.add);

  app
    .route('/api/contact-by/:contactUserId')
    .all(contactsPolicy.isAllowed)
    .get(contacts.get);

  app
    .route('/api/contact/:contactId')
    .all(contactsPolicy.isAllowed)
    .get(contacts.get)
    .put(contacts.confirm)
    .delete(contacts.remove);

  // Contact list
  app
    .route('/api/contacts/:listUserId')
    .all(contactsPolicy.isAllowed)
    .get(contacts.list);

  // Contact list of common contacts between users
  app
    .route('/api/contacts/:listUserId/common')
    .all(contactsPolicy.isAllowed)
    .get(contacts.filterByCommon, contacts.list);

  // Finish by binding middlewares
  app.param('listUserId', contacts.contactListByUser);
  app.param('contactId', contacts.contactById);
  app.param('contactUserId', contacts.contactByUserId);
};
