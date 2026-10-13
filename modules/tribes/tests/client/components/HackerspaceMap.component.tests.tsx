import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Event } from 'nostr-tools';
import HackerspaceMap, {
  decodeGeohash,
  parseHackerPlace,
} from '@/modules/tribes/client/components/HackerspaceMap';
import { useCircleMapEvents } from '@/modules/tribes/client/hooks/useCircleMapEvents';

jest.mock('@/modules/tribes/client/hooks/useCircleMapEvents');
jest.mock('@/modules/tribes/client/components/CircleLocationMap', () => ({
  __esModule: true,
  default: (props: unknown) => <pre>{JSON.stringify(props)}</pre>,
}));

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
      id: legacy.id,
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
  jest.mocked(useCircleMapEvents).mockReturnValue({
    state: 'ready',
    events: [
      event,
      {
        ...event,
        id: 'inactive',
        tags: [...event.tags, ['status', 'inactive']],
      },
      {
        ...event,
        id: 'bare',
        content: '',
        tags: [
          ['meta:source', 'https://api.spaceapi.io/'],
          ['g', 'gcpvj0'],
          ['name', 'Bare Workshop'],
          ['website', 'javascript:alert(1)'],
        ],
      },
      { ...event, tags: [] },
    ],
  });
  render(<HackerspaceMap />);
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
