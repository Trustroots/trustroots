import usersPolicy from './../policies/users.server.policy.mts';
import userBlock from './../controllers/users.block.server.controller.mts';

/**
 * Module dependencies.
 */

type RouteHandler = (...arguments_: never[]) => unknown;
interface RouteChain {
  all(...handlers: RouteHandler[]): RouteChain;
  get(...handlers: RouteHandler[]): RouteChain;
  put(...handlers: RouteHandler[]): RouteChain;
  delete(...handlers: RouteHandler[]): RouteChain;
}
interface RouteApplication {
  route(path: string): RouteChain;
}

export default function (app: RouteApplication) {
  // Setting up the users profile api
  app
    .route('/api/blocked-users')
    .all(usersPolicy.isAllowed)
    .get(userBlock.getBlockedUsers);
  app
    .route('/api/blocked-users/:username')
    .all(usersPolicy.isAllowed)
    .put(userBlock.blockUser)
    .delete(userBlock.unblockUser);
}
