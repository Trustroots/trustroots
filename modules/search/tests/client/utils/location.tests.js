import {
  getBounds,
  getBoundsObject,
  getCenter,
  shortTitle,
} from '@/modules/search/client/utils/location';

describe('location utils', () => {
  it('builds a bounds object from coordinates', () => {
    expect(getBoundsObject(1, 2, 0, 3)).toEqual({
      northEast: { lat: 1, lng: 2 },
      southWest: { lat: 0, lng: 3 },
    });
  });

  it('derives bounds from a bbox when present', () => {
    expect(
      getBounds({
        bbox: [1, 2, 3, 4],
      }),
    ).toEqual({
      northEast: { lat: 4, lng: 3 },
      southWest: { lat: 2, lng: 1 },
    });
  });

  it('derives bounds around centre coordinates when bbox is missing', () => {
    const bounds = getBounds({
      center: [2.3, 48.8],
    });

    expect(bounds.northEast).toEqual({
      lat: 48.802,
      lng: 2.298,
    });
    expect(bounds.southWest.lat).toBeCloseTo(48.798);
    expect(bounds.southWest.lng).toBeCloseTo(2.302);
  });

  it('returns false when bounds cannot be derived', () => {
    expect(getBounds(null)).toBe(false);
    expect(getBounds({ center: [1] })).toBe(false);
  });

  it('returns centre coordinates from centre or geometry', () => {
    expect(getCenter({ center: [2.3, 48.8] })).toEqual({
      lng: 2.3,
      lat: 48.8,
    });
    expect(
      getCenter({
        geometry: { coordinates: [5.1, 60.2] },
      }),
    ).toEqual({
      lng: 5.1,
      lat: 60.2,
    });
  });

  it('returns false when centre coordinates are invalid', () => {
    expect(getCenter({})).toBe(false);
    expect(getCenter({ center: [1] })).toBe(false);
  });

  it('builds a short title from place context', () => {
    expect(
      shortTitle({
        text: 'Paris',
        context: [
          { id: 'place.123', text: 'Paris' },
          { id: 'country.456', text: 'France' },
        ],
      }),
    ).toBe('Paris, Paris, France');
  });

  it('uses the full place name for US locations', () => {
    expect(
      shortTitle({
        text: 'Portland',
        place_name: 'Portland, Oregon, United States',
        context: [
          { id: 'country.789', text: 'United States', short_code: 'us' },
        ],
      }),
    ).toBe('Portland, Oregon, United States');
  });

  it('handles missing and unrelated place context', () => {
    expect(shortTitle({ text: 'Bergen' })).toBe('Bergen');
    expect(
      shortTitle({
        text: 'Bergen',
        context: [{ id: 'region.123', text: 'Vestland' }],
      }),
    ).toBe('Bergen');
  });

  it('falls back to place_name when text is missing', () => {
    expect(
      shortTitle({
        place_name: 'Helsinki, Finland',
      }),
    ).toBe('Helsinki, Finland');
  });

  it('handles incomplete and non-US place context entries', () => {
    expect(
      shortTitle({
        text: 'Madrid',
        context: [{ id: 'country.1', text: 'Spain', short_code: 'es' }],
      }),
    ).toBe('Madrid, Spain');
    expect(shortTitle({ text: 'Unknown', context: [] })).toBe('Unknown');
    expect(shortTitle({})).toBe('');
    expect(getBounds({ bbox: [1, 2, 3] })).toBe(false);
  });
});
