import { render, act } from '@testing-library/react';
import React from 'react';

import { timeAgo } from '@/modules/core/shared/time-ago.mts';
import TimeAgo from '@/modules/core/client/components/TimeAgo';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('<TimeAgo>', () => {
  it('starts with now', async () => {
    const { container } = render(<TimeAgo date={new Date()} />);
    expect(container).toHaveTextContent('now');
  });

  it('updates over time', () => {
    const { container } = render(<TimeAgo date={new Date()} />);
    act(() => {
      vi.advanceTimersByTime(34 * 60 * 1000);
    });
    expect(container).toHaveTextContent('34 minutes ago');
  });
});

describe('timeAgo', () => {
  it.each([
    [-5_000, '5 seconds ago'],
    [-34 * 60_000, '34 minutes ago'],
    [-3 * 3_600_000, '3 hours ago'],
    [-3 * 86_400_000, '3 days ago'],
    [-60 * 86_400_000, '2 months ago'],
    [-800 * 86_400_000, '2 years ago'],
    [-86_400_000, 'yesterday'],
  ])('formats %i ms as %s', (offset, expected) => {
    expect(timeAgo(new Date(Date.now() + offset))).toBe(expected);
  });

  it('localises with Intl', () => {
    expect(timeAgo(new Date(Date.now() - 3 * 86_400_000), 'de')).toBe(
      'vor 3 Tagen',
    );
  });
});
