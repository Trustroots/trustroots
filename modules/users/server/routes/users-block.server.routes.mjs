import usersPolicy from '../policies/users.server.policy.js';
import userBlock from '../controllers/users.block.server.controller.js';

/**
 * Module dependencies.
 */

const defaultExport = function (app) {
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
};
export default defaultExport;
