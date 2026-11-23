import { createRouteAuthorisation } from '../../../core/server/services/route-authorisation.server.service.mts';

const read = ['get'];
const isAllowed = createRouteAuthorisation({
  '/api/tribes': { admin: read, user: read, guest: read },
  '/api/tribes/:tribe': { admin: read, user: ['get', 'patch'], guest: read },
  '/api/tribes/:tribe/members': { admin: read, user: read },
  '/api/tribes/discovery/connections': { admin: read, user: read },
});
export { isAllowed };
export default { isAllowed };
