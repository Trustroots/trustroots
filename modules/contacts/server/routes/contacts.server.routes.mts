import type { Express, RequestHandler, RequestParamHandler } from 'express';

import contactsPolicy from './../policies/contacts.server.policy.mts';
import contacts from './../controllers/contacts.server.controller.mjs';

type MiddlewareCallback = (...args: never[]) => unknown;

// Route policies establish the request shape each narrower controller needs.
const routeHandler = <T extends MiddlewareCallback>(
  callback: T,
): RequestHandler => callback as unknown as RequestHandler;
const parameterHandler = <T extends MiddlewareCallback>(
  callback: T,
): RequestParamHandler => callback as unknown as RequestParamHandler;

/**
 * Module dependencies.
 */
function register(app: Express) {
  app
    .route('/api/contact')
    .all(routeHandler(contactsPolicy.isAllowed))
    .post(routeHandler(contacts.add));
  app
    .route('/api/contact-by/:contactUserId')
    .all(routeHandler(contactsPolicy.isAllowed))
    .get(routeHandler(contacts.get));
  app
    .route('/api/contact/:contactId')
    .all(routeHandler(contactsPolicy.isAllowed))
    .get(routeHandler(contacts.get))
    .put(routeHandler(contacts.confirm))
    .delete(routeHandler(contacts.remove));

  // Contact list
  app
    .route('/api/contacts/:listUserId')
    .all(routeHandler(contactsPolicy.isAllowed))
    .get(routeHandler(contacts.list));

  // Contact list of common contacts between users
  app
    .route('/api/contacts/:listUserId/common')
    .all(routeHandler(contactsPolicy.isAllowed))
    .get(routeHandler(contacts.filterByCommon), routeHandler(contacts.list));

  // Finish by binding middlewares
  app.param('listUserId', parameterHandler(contacts.contactListByUser));
  app.param('contactId', parameterHandler(contacts.contactById));
  app.param('contactUserId', parameterHandler(contacts.contactByUserId));
}
export { register };
export default register;
export { register as 'module.exports' };
