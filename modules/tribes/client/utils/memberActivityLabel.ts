import type { MemberActivity } from '@/modules/tribes/client/api/tribes.api';

export function memberActivityLabel(
  activity: MemberActivity | undefined,
  t: (key: string) => string,
): string | undefined {
  if (!activity) return undefined;
  const labels: Record<MemberActivity, string> = {
    today: 'Active today',
    week: 'Active this week',
    month: 'Active this month',
    older: 'Active more than a month ago',
  };
  return t(labels[activity]);
}
