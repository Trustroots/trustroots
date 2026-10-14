import _ from 'lodash';
export const restrictedMessagingRoles: string[] = ['suspended', 'shadowban'];
type RoleUser = { roles?: string[] } | null | undefined;

export function hasRole(user: RoleUser, role: string): boolean {
  return _.get(user, 'roles', [] as string[]).includes(role);
}
export function hasAnyRole(user: RoleUser, roles: string[]): boolean {
  return _.intersection(_.get(user, 'roles', [] as string[]), roles).length > 0;
}
export function hasRestrictedMessagingRole(user: RoleUser): boolean {
  return hasAnyRole(user, restrictedMessagingRoles);
}
const defaultInterop = {
  restrictedMessagingRoles,
  hasRole,
  hasAnyRole,
  hasRestrictedMessagingRole,
};
export default defaultInterop;
export { defaultInterop as 'module.exports' };
