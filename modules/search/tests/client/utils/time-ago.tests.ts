import { timeAgo } from '@/modules/search/client/utils/time-ago';

describe('timeAgo', () => {
  const realDateNow = Date.now;

  afterEach(() => {
    Date.now = realDateNow;
  });

  it('formats recent timestamps as relative time', () => {
    Date.now = jest.fn(() => 1_700_000_000_000);

    expect(timeAgo(1_699_999_970)).toBe('just now');
    expect(timeAgo(1_699_999_700)).toBe('5m ago');
    expect(timeAgo(1_699_992_800)).toBe('2h ago');
    expect(timeAgo(1_699_740_800)).toBe('3d ago');
  });

  it('formats older timestamps as a locale date', () => {
    Date.now = jest.fn(() => 1_700_000_000_000);

    expect(timeAgo(1_699_000_000)).toBe(
      new Date(1_699_000_000_000).toLocaleDateString(),
    );
  });
});
