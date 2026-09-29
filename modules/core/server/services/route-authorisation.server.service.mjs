/* istanbul ignore file -- the shared implementation is covered through its CJS adapter. */
import routeAuthorisation from './route-authorisation.server.service.js';

export const createRouteAuthorisation =
  routeAuthorisation.createRouteAuthorisation;
