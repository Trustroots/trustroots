import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Event } from 'nostr-tools';
import HackerspaceMap, {
  decodeGeohash,
  parseHackerPlace,
} from '@/modules/tribes/client/components/HackerspaceMap';
import { nostrService } from '@/modules/search/client/services/nostr.client.service';

jest.mock('@/modules/search/client/services/nostr.client.service', () => ({
  nostrService: {
    subscribeHackerPlaces: jest.fn(),
    unsubscribeHackerPlaces: jest.fn(),
  },
}));
jest.mock('@/modules/tribes/client/components/CircleLocationMap', () => ({
  __esModule: true,
  default: (props: unknown) => <pre>{JSON.stringify(props)}</pre>,
}));

beforeEach(() => {
  jest.clearAllMocks();
});

function latestSubscription() {
  const calls = jest.mocked(nostrService.subscribeHackerPlaces).mock.calls;
  const call = calls[calls.length - 1];
  return { onEvent: call[0], callbacks: call[1] ?? {} };
}

function place(tags: string[][] = [], content = ''): Event {
  return {
    id: 'event-id',
    pubkey: 'fictional-key',
    sig: 'fictional-signature',
    kind: 33000,
    created_at: 1,
    content,
    tags: [
      ['meta', 'source', 'https://api.spaceapi.io/'],
      ['name', 'Example Workshop'],
      ['g', 'gcpvj0'],
      ...tags,
    ],
  };
}
describe('hackerspace place event parsing', () => {
  it('handles legacy metadata, multiple precisions, missing names and inactive states', () => {
    const legacy = place();
    legacy.tags = [
      ['meta:source', 'https://api.spaceapi.io/'],
      ['name', 'Legacy Workshop'],
      ['g', 'g'],
      ['g', ''],
      ['g', 'gcpvj0'],
      ['g', 'gc'],
      ['status', 'inactive'],
      ['website', 'javascript:invalid'],
    ];
    expect(parseHackerPlace(legacy)).toMatchObject({
      id: `${legacy.pubkey}:${legacy.id}`,
      inactive: true,
      website: undefined,
    });
    expect(
      parseHackerPlace({
        ...legacy,
        tags: legacy.tags.filter(tag => tag[0] !== 'name'),
      }),
    ).toBeNull();
    expect(
      parseHackerPlace({
        ...place(),
        tags: [
          ['meta', 'source', 'https://api.spaceapi.io/'],
          ['name', 'Missing location'],
        ],
      }),
    ).toBeNull();
    expect(
      parseHackerPlace({
        ...legacy,
        tags: [['meta:source', 'https://unrelated.example.test/']],
      }),
    ).toBeNull();
    expect(decodeGeohash('')).toBeNull();
  });

  it('decodes a standard geohash to a location', () => {
    const point = decodeGeohash('gcpvj0');
    expect(point?.[0]).toBeCloseTo(51.5, 0);
    expect(point?.[1]).toBeCloseTo(-0.1, 0);
  });
  it('uses the stable identifier, location, source metadata and safe website', () => {
    const authored = place([['d', 'shared-place']]);
    expect(parseHackerPlace(authored)?.id).toBe('fictional-key:shared-place');
    expect(parseHackerPlace({ ...authored, pubkey: undefined })?.id).toBe(
      'shared-place',
    );
    expect(parseHackerPlace({ ...place(), pubkey: undefined })?.id).toBe(
      'event-id',
    );
    expect(
      parseHackerPlace({
        id: 'event-id',
        content: 'Reported place',
        tags: [
          ['d', 'spaceapi:https://example.test/api'],
          ['meta', 'source', 'https://api.spaceapi.io/'],
          ['name', 'Example Workshop'],
          ['g', 'gcpvj0'],
          ['website', 'https://example.test'],
          ['meta', 'open', 'open'],
          ['meta', 'fetched_at', '2026-10-12T10:00:00Z'],
        ],
      }),
    ).toMatchObject({
      id: 'spaceapi:https://example.test/api',
      name: 'Example Workshop',
      website: 'https://example.test',
      open: 'open',
      fetchedAt: '2026-10-12T10:00:00Z',
    });
  });
  it('rejects malformed coordinates and unsafe links', () => {
    expect(decodeGeohash('!')).toBeNull();
    expect(
      parseHackerPlace({
        id: 'x',
        content: '',
        tags: [
          ['name', 'No location'],
          ['website', 'javascript:alert(1)'],
        ],
      }),
    ).toBeNull();
    expect(
      parseHackerPlace({
        id: 'x',
        content: '',
        tags: [
          ['name', 'No link'],
          ['g', 'gcpvj0'],
          ['website', 'javascript:alert(1)'],
        ],
      })?.website,
    ).toBeUndefined();
  });
});

it('adapts hackerspace metadata into the shared map and excludes inactive/invalid events', () => {
  jest.mocked(nostrService.subscribeHackerPlaces).mockResolvedValue({
    close: jest.fn(),
  });
  const event = {
    id: 'event',
    content: 'A workshop',
    tags: [
      ['meta', 'source', 'https://api.spaceapi.io/'],
      ['g', 'gcpvj0'],
      ['g', 'gcp'],
      ['name', 'Example Workshop'],
      ['address', 'Fictional Road'],
      ['website', 'https://example.test/'],
      ['meta', 'open', 'open'],
      ['meta', 'fetched_at', '2026-10-12'],
    ],
  } as Event;
  render(<HackerspaceMap />);
  const { onEvent, callbacks } = latestSubscription();
  act(() => {
    onEvent(event);
    onEvent(event);
    onEvent({
      ...event,
      id: 'inactive',
      tags: [...event.tags, ['status', 'inactive']],
    });
    onEvent({
      ...event,
      id: 'bare',
      content: '',
      tags: [
        ['meta:source', 'https://api.spaceapi.io/'],
        ['g', 'gcpvj0'],
        ['name', 'Bare Workshop'],
        ['website', 'javascript:alert(1)'],
      ],
    });
    onEvent({ ...event, id: 'empty', tags: [] });
    callbacks.onEose?.();
  });
  const props = JSON.parse(
    screen.getByText(/SpaceAPI-reported places/).textContent!,
  );
  expect(props.locations).toHaveLength(2);
  expect(props.locations[0].details).toEqual([
    'Fictional Road',
    'A workshop',
    'SpaceAPI-reported snapshot: open',
    'Trustroots fetched: 2026-10-12',
  ]);
  expect(props.locations[0].link.url).toBe('https://example.test/');
  expect(props.locations[1].link).toBeUndefined();
  expect(props.locations[1].details).toEqual([]);
  expect(props.markerColor).toBe('#12b591');
  expect(props.className).toBe('circle-location-map-panel--brand');
  expect(props.loadingText).toBe(
    'Loading places from Trustroots and Nomadwiki relays…',
  );
  expect(props.state).toBe('ready');
  expect(
    parseHackerPlace({
      ...event,
      tags: [
        ['meta', 'source', 'https://api.spaceapi.io/'],
        ['name', 'No coordinates'],
      ],
    }),
  ).toBeNull();
  expect(
    parseHackerPlace({
      ...event,
      tags: [
        ['meta', 'source', 'https://api.spaceapi.io/'],
        ['g', 'gcpvj0'],
      ],
    }),
  ).toBeNull();
  expect(
    parseHackerPlace({
      ...event,
      tags: [...event.tags, ['meta:status', 'inactive']],
    })?.inactive,
  ).toBe(true);
  expect(
    parseHackerPlace({
      ...event,
      tags: event.tags.filter(tag => tag[0] !== 'website'),
    })?.website,
  ).toBeUndefined();
});

it('reports relay closure and ignores updates after unmount', async () => {
  jest.mocked(nostrService.subscribeHackerPlaces).mockResolvedValue({
    close: jest.fn(),
  });
  const { unmount } = render(<HackerspaceMap />);
  const { onEvent, callbacks } = latestSubscription();
  act(() => callbacks.onClose?.('closed'));
  expect(
    JSON.parse(screen.getByText(/could not be loaded/).textContent!).state,
  ).toBe('error');
  unmount();
  expect(nostrService.unsubscribeHackerPlaces).toHaveBeenCalled();
  act(() => {
    onEvent(place());
    callbacks.onEose?.();
    callbacks.onClose?.('closed');
  });
});

it('shows an error when the relay subscription fails', async () => {
  jest
    .mocked(nostrService.subscribeHackerPlaces)
    .mockRejectedValue(new Error('offline'));
  render(<HackerspaceMap />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(
    JSON.parse(screen.getByText(/could not be loaded/).textContent!).state,
  ).toBe('error');
});

it('ignores a connection rejection after unmount', async () => {
  let reject!: (error: Error) => void;
  jest.mocked(nostrService.subscribeHackerPlaces).mockReturnValue(
    new Promise((_resolve, fail) => {
      reject = fail;
    }),
  );
  const { unmount } = render(<HackerspaceMap />);
  unmount();
  await act(async () => {
    reject(new Error('offline'));
  });
  expect(nostrService.unsubscribeHackerPlaces).toHaveBeenCalled();
});
