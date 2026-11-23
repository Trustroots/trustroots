export const restrictedMessagingRoles: string[] = ['suspended', 'shadowban'];
type RoleUser = { roles?: string[] } | null | undefined;

export function hasRole(user: RoleUser, role: string): boolean {
  return (user?.roles ?? []).includes(role);
}
export function hasAnyRole(user: RoleUser, roles: string[]): boolean {
  return (user?.roles ?? []).some(userRole => roles.includes(userRole));
}
export function hasRestrictedMessagingRole(user: RoleUser): boolean {
  return hasAnyRole(user, restrictedMessagingRoles);
}
export default {
  restrictedMessagingRoles,
  hasRole,
  hasAnyRole,
  hasRestrictedMessagingRole,
};
