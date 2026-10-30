import { act, renderHook, waitFor } from '@testing-library/react';
import useMapDefaultLocation, {
  requestMapDefaultLocation,
} from '@/modules/core/client/utils/use-map-default-location';

const mockGet = jest.fn();
let mockUser: { _id: string } | null;
jest.mock('@/modules/core/client/api/http-client', () => ({
  __esModule: true,
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  getCurrentUser: () => mockUser,
}));

const location = { latitude: 34, longitude: -17, zoom: 6 };
function delayedLookup() {
  let resolve!: (value: { data: { location: typeof location } }) => void;
  mockGet.mockReturnValue(
    new Promise(done => {
      resolve = done;
    }),
  );
  return () =>
    act(async () => {
      resolve({ data: { location } });
    });
}

describe('Approximate initial map location', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockUser = { _id: 'fictional-member' };
  });

  it('skips anonymous users and maps with a higher-priority destination', () => {
    const { rerender } = renderHook(
      ({ enabled }) => useMapDefaultLocation(enabled),
      { initialProps: { enabled: false } },
    );
    mockUser = null;
    rerender({ enabled: true });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('does not request an approximate location for anonymous users', async () => {
    mockUser = null;

    await expect(requestMapDefaultLocation()).resolves.toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns an authenticated location from the shared in-flight request', async () => {
    const finish = delayedLookup();
    const first = requestMapDefaultLocation();
    const second = requestMapDefaultLocation();
    expect(mockGet).toHaveBeenCalledTimes(1);

    await finish();
    await expect(first).resolves.toEqual(location);
    await expect(second).resolves.toEqual(location);
  });

  it('discards an approximate result if the authenticated account changes', async () => {
    const finish = delayedLookup();
    const result = requestMapDefaultLocation();
    mockUser = { _id: 'another-fictional-member' };

    await finish();
    await expect(result).resolves.toBeNull();
  });

  it('shares only in-flight requests and does not persist results', async () => {
    const finish = delayedLookup();
    const first = renderHook(() => useMapDefaultLocation(true));
    const second = renderHook(() => useMapDefaultLocation(true));
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('/api/map-default-location', {
      timeout: 5000,
    });
    await finish();
    expect(first.result.current[0]).toEqual(location);
    expect(second.result.current[0]).toEqual(location);
    mockGet.mockResolvedValue({ data: { location: null } });
    const third = renderHook(() => useMapDefaultLocation(true));
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    expect(third.result.current[0]).toBeNull();
  });

  it.each([
    null,
    { ...location, latitude: NaN },
    { ...location, latitude: 86 },
    { ...location, longitude: NaN },
    { ...location, longitude: 181 },
    { ...location, zoom: NaN },
    { ...location, zoom: -1 },
    { ...location, zoom: 7 },
  ])('ignores invalid response %j', async value => {
    mockGet.mockResolvedValue({ data: { location: value } });
    const { result } = renderHook(() => useMapDefaultLocation(true));
    await act(async () => {});
    expect(result.current[0]).toBeNull();
  });

  it('keeps the fallback usable after a request failure', async () => {
    mockGet.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useMapDefaultLocation(true));
    await act(async () => {});
    expect(result.current[0]).toBeNull();
  });

  it('ignores late results after interaction and does not restart a stopped lookup', async () => {
    const finish = delayedLookup();
    const { result, rerender } = renderHook(
      ({ enabled }) => useMapDefaultLocation(enabled),
      { initialProps: { enabled: true } },
    );
    act(() => result.current[1]());
    await finish();
    expect(result.current[0]).toBeNull();
    rerender({ enabled: false });
    rerender({ enabled: true });
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('ignores late responses after a destination arrives or the map unmounts', async () => {
    const finish = delayedLookup();
    const hook = renderHook(({ enabled }) => useMapDefaultLocation(enabled), {
      initialProps: { enabled: true },
    });
    hook.rerender({ enabled: false });
    hook.unmount();
    await finish();
  });

  it('isolates account changes, including resolved results', async () => {
    mockGet.mockResolvedValue({ data: { location } });
    const { result, rerender } = renderHook(() => useMapDefaultLocation(true));
    await waitFor(() => expect(result.current[0]).toEqual(location));
    const finish = delayedLookup();
    mockUser = { _id: 'another-fictional-member' };
    rerender();
    expect(result.current[0]).toBeNull();
    mockUser = null;
    await finish();
    expect(result.current[0]).toBeNull();
  });
});
