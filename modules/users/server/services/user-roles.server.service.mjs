import _ from 'lodash';

export const restrictedMessagingRoles = ['suspended', 'shadowban'];

export function hasRole(user, role) {
  return _.get(user, 'roles', []).includes(role);
}

export function hasAnyRole(user, roles) {
  return _.intersection(_.get(user, 'roles', []), roles).length > 0;
}

export function hasRestrictedMessagingRole(user) {
  return hasAnyRole(user, restrictedMessagingRoles);
}
