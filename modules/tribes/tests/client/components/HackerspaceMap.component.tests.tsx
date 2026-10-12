import {
  decodeGeohash,
  parseHackerPlace,
} from '@/modules/tribes/client/components/HackerspaceMap';

describe('hackerspace place event parsing', () => {
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
