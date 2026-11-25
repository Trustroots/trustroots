import { render, act } from '@testing-library/react';
import React from 'react';

import i18n from '@/config/client/i18n';
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

  it('renders an invalid timestamp without throwing', () => {
    const { container } = render(<TimeAgo date={new Date('')} />);
    expect(container).toHaveTextContent('Invalid date');
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

describe('date interpolation', () => {
  it('formats dates in languages configured with an underscore', () => {
    const date = new Date(2024, 0, 1);
    expect(i18n.t('Date {{date, LL}}', { date, lng: 'pt_BR' })).toBe(
      'Date 1 de janeiro de 2024',
    );
  });

  it('preserves the calendar formats used by profiles and pages', () => {
    vi.setSystemTime(new Date(2024, 0, 1));
    const date = new Date(2000, 0, 2);
    expect(i18n.t('{{date, age}} years', { date, lng: 'en' })).toBe('23 years');
    expect(i18n.t('Since {{date, YYYY}}', { date, lng: 'en' })).toBe(
      'Since 2000',
    );
    expect(i18n.t('On {{date, MMMM Do}}', { date, lng: 'en' })).toBe(
      'On January 2nd',
    );
  });
});
