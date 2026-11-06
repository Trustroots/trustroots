export function formatRoleLabel(role: string): string {
  if (role === 'flagged') return 'Flagged for follow-up';
  return role === 'welcome-team'
    ? 'Greeter'
    : role === 'support-team'
      ? 'Support team'
      : role;
}
