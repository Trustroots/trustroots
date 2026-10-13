import '@testing-library/jest-dom';
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import type { Event } from 'nostr-tools';
import HitchhikingMap from '@/modules/tribes/client/components/HitchhikingMap';
import { useCircleMapEvents } from '@/modules/tribes/client/hooks/useCircleMapEvents';
import {
  HITCHWIKI_AUTHOR,
  HITCHHIKING_KIND,
  HITCHWIKI_RELAY,
} from '@/modules/tribes/client/services/hitchhiking.client.service';
jest.mock('@/modules/tribes/client/hooks/useCircleMapEvents');
jest.mock('@/modules/tribes/client/components/CircleLocationMap', () => ({
  __esModule: true,
  default: (props: { locations: unknown[]; attribution: React.ReactNode }) => (
    <div>
      {props.locations.length} origins{props.attribution}
    </div>
  ),
}));

it('requests recent rides and deletions, and expires locations as the window advances', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-12T12:00:00Z'));
  const content = {
    source: 'maps.hitchwiki.org',
    stops: [
      {
        location: { latitude: 12, longitude: 34 },
        arrival_time: '2026-10-05T12:00:00Z',
      },
    ],
  };
  jest.mocked(useCircleMapEvents).mockReturnValue({
    state: 'ready',
    events: [
      {
        id: 'example',
        kind: HITCHHIKING_KIND,
        pubkey: HITCHWIKI_AUTHOR,
        content: JSON.stringify(content),
        tags: [['d', 'ride']],
      },
      { id: 'invalid', kind: 1 },
    ] as Event[],
  });
  const { unmount } = render(<HitchhikingMap />);
  expect(screen.getByText(/^1 origins/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'ODbL' })).toHaveAttribute(
    'href',
    'https://opendatacommons.org/licenses/odbl/1-0/',
  );
  expect(useCircleMapEvents).toHaveBeenCalledWith(
    expect.objectContaining({ relayUrl: HITCHWIKI_RELAY }),
    [
      {
        kinds: [36820],
        authors: [HITCHWIKI_AUTHOR],
        since: Date.parse('2026-10-05T12:00:00Z') / 1000,
      },
      { kinds: [5], authors: [HITCHWIKI_AUTHOR], '#k': ['36820'] },
    ],
    true,
  );
  act(() => jest.advanceTimersByTime(60_000));
  expect(screen.getByText(/^0 origins/)).toBeInTheDocument();
  unmount();
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
});
