import {
  buildInactiveSpaceApiPlaceEvent,
  buildSpaceApiPlaceEvent,
  geohash,
  getSpaceApiIdentifier,
  type AddressablePlaceEvent,
  type SpaceApiPlace,
} from '@/modules/admin/client/services/hackerspaces-nostr.client.service';
import { OpenLocationCode } from 'open-location-code';

const space: SpaceApiPlace = {
  endpoint: 'https://example.test/spaceapi.json',
  name: 'Example Workshop',
  website: 'https://example.test',
  latitude: 51.5,
  longitude: -0.1,
  address: '1 Example Road, London',
  addressParts: ['1 Example Road', 'London', '', '', ''],
  description: 'A shared workshop.',
  open: 'open',
  fetchedAt: '2026-10-12T10:00:00.000Z',
  spaceType: 'hackerspace',
};

describe('NIP-41 SpaceAPI place events', () => {
  it('refuses to build an active event for a closed space', () => {
    expect(() => buildSpaceApiPlaceEvent({ ...space, open: 'closed' })).toThrow(
      /Closed hackerspaces/,
    );
  });
  it('uses display defaults when optional details are missing and Plus Codes fail', () => {
    const encode = jest
      .spyOn(OpenLocationCode.prototype, 'encode')
      .mockImplementation(() => {
        throw new Error('optional encoding unavailable');
      });
    try {
      const result = buildSpaceApiPlaceEvent({
        ...space,
        addressParts: undefined,
        spaceType: '',
        description: '',
      });
      expect(result.tags).toContainEqual([
        'address',
        space.address,
        '',
        '',
        '',
        '',
      ]);
      expect(result.tags).toContainEqual([
        'l',
        'hackerspace',
        'physical-location',
      ]);
      expect(result.tags.some(tag => tag[2] === 'open-location-code')).toBe(
        false,
      );
      expect(result.content).toMatch(/not been independently verified/);
    } finally {
      encode.mockRestore();
    }
  });
  it('uses stable identifiers and geohash ladders', () => {
    expect(getSpaceApiIdentifier(space.endpoint)).toBe(
      'spaceapi:https://example.test/spaceapi.json',
    );
    expect(geohash(51.5, -0.1, 6)).toBe('gcpuvx');
    const event = buildSpaceApiPlaceEvent(space);
    expect(event.kind).toBe(33000);
    expect(event.tags[0]).toEqual(['d', getSpaceApiIdentifier(space.endpoint)]);
    expect(event.tags.filter(tag => tag[0] === 'g')).toHaveLength(12);
    expect(event.tags).toContainEqual(['L', 'physical-location']);
    expect(event.tags).toContainEqual([
      'address',
      '1 Example Road',
      'London',
      '',
      '',
      '',
    ]);
    expect(event.tags).toContainEqual([
      'meta',
      'verification',
      'spaceapi-reported; not-human-verified',
    ]);
    expect(
      event.tags.some(tag => tag[0] === 'l' && tag[2] === 'open-location-code'),
    ).toBe(true);
  });

  it('marks removed entries inactive while retaining address and content', () => {
    const active = buildSpaceApiPlaceEvent(space);
    const signed = {
      ...active,
      id: 'event-id',
      pubkey: 'a'.repeat(64),
      sig: 'b'.repeat(128),
    } as AddressablePlaceEvent;
    const inactive = buildInactiveSpaceApiPlaceEvent(signed);
    expect(inactive.created_at).toBeGreaterThan(signed.created_at);
    expect(
      buildInactiveSpaceApiPlaceEvent({ ...signed, created_at: 0 }).created_at,
    ).toBeGreaterThan(0);
    expect(inactive.tags).toContainEqual(['meta', 'status', 'inactive']);
    expect(inactive.tags).toContainEqual(['address', ...space.addressParts!]);
    expect(inactive.content).toBe(space.description);
  });
});
