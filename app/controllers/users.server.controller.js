'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash');

// Restricted set of profile fields when only really "miniprofile" is needed
var userMiniProfileFields = ['id', 'displayName', 'username', 'avatarSource', 'emailHash', 'languages'].join(' ');

/**
 * Extend user's controller
 */
module.exports = _.extend(
  require('./users/users.authentication'),
  require('./users/users.authorization'),
  require('./users/users.password'),
  require('./users/users.profile')
);
