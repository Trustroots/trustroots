import contactsPolicy from './../policies/contacts.server.policy.mjs';
import contacts from './../controllers/contacts.server.controller.mjs';

/**
 * Module dependencies.
 */
function register(app) {
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
}
export { register };
export default register;
export { register as 'module.exports' };
