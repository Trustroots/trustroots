/**
 * Module dependencies.
 */
const usersPolicy = require('../policies/users.server.policy');
const userBlock = require('../controllers/users.block.server.controller');

module.exports = function (app) {
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
