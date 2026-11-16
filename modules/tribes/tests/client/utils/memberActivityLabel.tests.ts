import { memberActivityLabel } from '@/modules/tribes/client/utils/memberActivityLabel';

describe('memberActivityLabel', () => {
  it.each([
    ['today', 'Active today'],
    ['week', 'Active this week'],
    ['month', 'Active this month'],
    ['older', 'Active more than a month ago'],
  ] as const)('labels %s activity', (activity, expected) => {
    expect(memberActivityLabel(activity, key => key)).toBe(expected);
  });

  it('returns no label for missing activity', () => {
    expect(memberActivityLabel(undefined, key => key)).toBeUndefined();
  });
});
