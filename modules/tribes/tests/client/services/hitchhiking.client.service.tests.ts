import type { Event } from 'nostr-tools';
import {
  HITCHWIKI_AUTHOR,
  HITCHHIKING_KIND,
  SEVEN_DAYS_SECONDS,
  parseHitchhikingLocation,
} from '@/modules/tribes/client/services/hitchhiking.client.service';
import { currentPlaceEvents } from '@/modules/tribes/client/hooks/useCircleMapEvents';

const now = Date.parse('2026-10-12T12:00:00Z') / 1000;
const data = {
  source: 'https://maps.hitchwiki.org/',
  stops: [
    {
      location: { latitude: 12, longitude: 34, is_exact: false },
      arrival_time: '2026-10-11T12:00:00Z[Test/Zone]',
    },
  ],
  submission_time: '2026-10-12T11:00:00Z',
};
function event(content: unknown = data, overrides: Partial<Event> = {}): Event {
  return {
    id: 'example-event',
    kind: HITCHHIKING_KIND,
    pubkey: HITCHWIKI_AUTHOR,
    created_at: now - 3600,
    tags: [['d', 'example-ride']],
    content: JSON.stringify(content),
    sig: '',
    ...overrides,
  };
}

describe('Hitchwiki ride origins', () => {
  it('uses origin coordinates and recorded date, with a source link and approximate disclosure', () => {
    expect(parseHitchhikingLocation(event(), now)).toMatchObject({
      latitude: 12,
      longitude: 34,
      details: [
        'Recorded: 2026-10-11T12:00:00.000Z',
        'Approximate reported location.',
        'Source: maps.hitchwiki.org',
      ],
      link: { url: 'https://maps.hitchwiki.org/ride/example-ride' },
    });
  });
  it('falls back to submission time for undated rides and handles exact locations and departure time', () => {
    const stops = [{ location: { latitude: 0, longitude: 0, is_exact: true } }];
    expect(
      parseHitchhikingLocation(event({ ...data, stops }), now)?.details[0],
    ).toContain('Submitted (ride date unknown)');
    expect(
      parseHitchhikingLocation(
        event({
          ...data,
          stops: [{ ...stops[0], departure_time: data.stops[0].arrival_time }],
        }),
        now,
      )?.details[0],
    ).toContain('Recorded:');
  });
  it.each([now - SEVEN_DAYS_SECONDS - 1, now + 1])(
    'rejects dates outside the rolling window: %s',
    time => {
      const stops = [
        { ...data.stops[0], arrival_time: new Date(time * 1000).toISOString() },
      ];
      expect(
        parseHitchhikingLocation(event({ ...data, stops }), now),
      ).toBeNull();
    },
  );
  it('includes the exact cutoff and rejects unknown times', () => {
    const stops = [
      {
        ...data.stops[0],
        arrival_time: new Date((now - SEVEN_DAYS_SECONDS) * 1000).toISOString(),
      },
    ];
    expect(
      parseHitchhikingLocation(event({ ...data, stops }), now),
    ).not.toBeNull();
    expect(
      parseHitchhikingLocation(
        event({ ...data, stops: [], submission_time: null }),
        now,
      ),
    ).toBeNull();
    expect(
      parseHitchhikingLocation(
        event({
          ...data,
          stops: [{ ...data.stops[0], arrival_time: 'bad' }],
          submission_time: 'bad',
        }),
        now,
      ),
    ).toBeNull();
  });
  it.each([
    null,
    {},
    { ...data, source: undefined },
    { ...data, source: 'https://unrelated.test' },
    { ...data, stops: [{}] },
    { ...data, stops: [{ location: { latitude: '12', longitude: 34 } }] },
    { ...data, stops: [{ location: { latitude: 12, longitude: '34' } }] },
    { ...data, stops: [{ location: { latitude: 91, longitude: 34 } }] },
    { ...data, stops: [{ location: { latitude: 12, longitude: 181 } }] },
  ])('rejects malformed data: %j', content => {
    expect(parseHitchhikingLocation(event(content), now)).toBeNull();
  });
  it('rejects non-rides, untrusted authors, malformed JSON and missing identifiers', () => {
    for (const overrides of [
      { kind: 1 },
      { pubkey: 'other-author' },
      { content: '{' },
      { tags: [] },
    ])
      expect(parseHitchhikingLocation(event(data, overrides), now)).toBeNull();
  });
  it('encodes identifiers in links', () => {
    expect(
      parseHitchhikingLocation(
        event(data, { tags: [['d', 'fictional/id?']] }),
        now,
      )?.link?.url,
    ).toBe('https://maps.hitchwiki.org/ride/fictional%2Fid%3F');
  });
});

describe('addressable circle event state', () => {
  it('keeps the newest version regardless of arrival order, breaking ties by lowest id', () => {
    const older = event(data, { id: 'z', created_at: now - 7200 });
    const newer = event(data, { id: 'b' });
    const tie = event(data, { id: 'a' });
    expect(currentPlaceEvents([newer, older, tie, newer])).toEqual([tie]);
    expect(currentPlaceEvents([event(data, { tags: [] })])).toHaveLength(1);
  });
  it('honours matching author address/id deletions and lets later versions reappear', () => {
    const ride = event();
    const deletion = event(
      {},
      {
        kind: 5,
        id: 'deletion',
        created_at: now,
        tags: [['a', `${ride.kind}:${ride.pubkey}:example-ride`]],
      },
    );
    expect(currentPlaceEvents([ride, deletion])).toEqual([]);
    expect(
      currentPlaceEvents([ride, { ...deletion, pubkey: 'someone-else' }]),
    ).toEqual([ride]);
    expect(
      currentPlaceEvents([ride, { ...deletion, tags: [['e', ride.id]] }]),
    ).toEqual([]);
    expect(
      currentPlaceEvents([
        ride,
        { ...deletion, tags: [['e', 'different-id']] },
      ]),
    ).toEqual([ride]);
    const later = { ...ride, created_at: now + 1 };
    expect(currentPlaceEvents([deletion, later])).toEqual([later]);
  });
});
