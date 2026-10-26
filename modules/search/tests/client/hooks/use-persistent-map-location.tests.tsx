import { act, renderHook } from '@testing-library/react';
import usePersistentMapLocation, {
  isRecentMapLocation,
  MAP_LOCATION_MAX_AGE,
} from '@/modules/search/client/hooks/use-persistent-map-location';

const fallback = { latitude: 40, longitude: -20, zoom: 6 };
const saved = {
  latitude: 0,
  longitude: 0,
  zoom: 5,
  version: 1,
  savedAt: 1000000000,
};

describe('Search viewport expiry', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.spyOn(Date, 'now').mockReturnValue(saved.savedAt + 100);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('restores recent positions without refreshing their timestamp', () => {
    localStorage.setItem('search-map-location', JSON.stringify(saved));
    const { result } = renderHook(() => usePersistentMapLocation(fallback));
    expect(result.current[0]).toMatchObject({
      latitude: 0,
      longitude: 0,
      zoom: 5,
    });
    expect(result.current[2]).toBe(true);
    expect(JSON.parse(localStorage.getItem('search-map-location')!)).toEqual(
      saved,
    );
  });

  it.each([
    null,
    'broken',
    {},
    fallback,
    { ...saved, version: 2 },
    { ...saved, latitude: NaN },
    { ...saved, latitude: 86 },
    { ...saved, longitude: NaN },
    { ...saved, longitude: 181 },
    { ...saved, zoom: NaN },
    { ...saved, zoom: -1 },
    { ...saved, zoom: 23 },
    { ...saved, savedAt: NaN },
    { ...saved, savedAt: saved.savedAt + 101 },
    { ...saved, savedAt: saved.savedAt + 100 - MAP_LOCATION_MAX_AGE },
  ])('ignores and clears invalid, legacy or expired state %j', value => {
    localStorage.setItem('search-map-location', JSON.stringify(value));
    const { result } = renderHook(() => usePersistentMapLocation(fallback));
    expect(result.current[0]).toEqual(fallback);
    expect(result.current[2]).toBe(false);
    expect(localStorage.getItem('search-map-location')).toBeNull();
  });

  it('accepts the last millisecond before expiry', () => {
    expect(
      isRecentMapLocation(saved, saved.savedAt + MAP_LOCATION_MAX_AGE - 1),
    ).toBe(true);
  });

  it('writes versioned positions only on deliberate changes and keeps active maps usable', () => {
    const { result, rerender } = renderHook(() =>
      usePersistentMapLocation(fallback),
    );
    expect(localStorage.getItem('search-map-location')).toBeNull();
    act(() => result.current[1]({ latitude: 12, longitude: 34, zoom: 8 }));
    expect(JSON.parse(localStorage.getItem('search-map-location')!)).toEqual({
      latitude: 12,
      longitude: 34,
      zoom: 8,
      version: 1,
      savedAt: saved.savedAt + 100,
    });
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(saved.savedAt + MAP_LOCATION_MAX_AGE + 1000);
    rerender();
    expect(result.current[0]).toEqual({ latitude: 12, longitude: 34, zoom: 8 });
  });

  it.each([
    [181, -179],
    [-181, 179],
    [541, -179],
    [-541, 179],
    [180, 180],
    [-180, -180],
    [34.123456, 34.123456],
  ])('restores a saved longitude of %s as %s', (longitude, expected) => {
    const position = { latitude: 12, longitude, zoom: 8 };
    const { result, unmount } = renderHook(() =>
      usePersistentMapLocation(fallback),
    );
    act(() => result.current[1](position));
    expect(result.current[0]).toEqual(position);
    const stored = JSON.parse(localStorage.getItem('search-map-location')!);
    expect(stored).toEqual({
      ...position,
      longitude: expected,
      version: 1,
      savedAt: saved.savedAt + 100,
    });
    unmount();

    jest.spyOn(Date, 'now').mockReturnValue(saved.savedAt + 200);
    const restored = renderHook(() => usePersistentMapLocation(fallback));
    expect(restored.result.current[0]).toMatchObject({
      ...position,
      longitude: expected,
    });
    expect(restored.result.current[2]).toBe(true);
    expect(JSON.parse(localStorage.getItem('search-map-location')!)).toEqual(
      stored,
    );
  });

  it('remains usable when browser storage throws', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('unavailable');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('unavailable');
    });
    const { result } = renderHook(() => usePersistentMapLocation(fallback));
    act(() => result.current[1]({ latitude: 12, longitude: 34, zoom: 8 }));
    expect(result.current[0]).toEqual({ latitude: 12, longitude: 34, zoom: 8 });
  });
});
