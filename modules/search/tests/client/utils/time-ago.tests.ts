import { compactTimeAgo } from '@trustroots/relative-time/compact';

describe('compactTimeAgo', () => {
  const realDateNow = Date.now;

  afterEach(() => {
    Date.now = realDateNow;
  });

  it('formats recent timestamps as relative time', () => {
    Date.now = vi.fn(() => 1_700_000_000_000);

    expect(compactTimeAgo(1_699_999_970)).toBe('just now');
    expect(compactTimeAgo(1_699_999_700)).toBe('5m ago');
    expect(compactTimeAgo(1_699_992_800)).toBe('2h ago');
    expect(compactTimeAgo(1_699_740_800)).toBe('3d ago');
  });

  it('formats older timestamps as a locale date', () => {
    Date.now = vi.fn(() => 1_700_000_000_000);

    expect(compactTimeAgo(1_699_000_000)).toBe(
      new Date(1_699_000_000_000).toLocaleDateString(),
    );
  });
});
