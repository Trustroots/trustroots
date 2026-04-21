const _ = require('lodash');

const restrictedMessagingRoles = ['suspended', 'shadowban'];

function hasRole(user, role) {
  return _.get(user, 'roles', []).includes(role);
}

function hasAnyRole(user, roles) {
  return _.intersection(_.get(user, 'roles', []), roles).length > 0;
}

function hasRestrictedMessagingRole(user) {
  return hasAnyRole(user, restrictedMessagingRoles);
}

module.exports = {
  restrictedMessagingRoles,
  hasRole,
  hasAnyRole,
  hasRestrictedMessagingRole,
};
