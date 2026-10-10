export function formatRoleLabel(role: string): string {
  return role === 'welcome-team'
    ? 'Greeter'
    : role === 'support-team'
    ? 'Support team'
    : role;
}
