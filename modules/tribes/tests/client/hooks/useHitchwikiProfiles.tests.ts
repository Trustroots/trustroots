import { act, renderHook, waitFor } from '@testing-library/react';
import { useHitchwikiProfiles } from '@/modules/tribes/client/hooks/useHitchwikiProfiles';
import type { CircleLocation } from '@/modules/tribes/client/components/CircleLocationMap';

const location: CircleLocation = {
  id: 'example',
  name: 'Origin',
  latitude: 0,
  longitude: 0,
  details: [],
  facts: [
    { label: 'Waiting time', value: '3 min' },
    {
      label: 'Hitchhikers',
      value: [
        {
          label: 'example hiker',
          url: 'https://maps.hitchwiki.org/account/example%20hiker',
        },
        {
          label: 'OtherHiker',
          url: 'https://maps.hitchwiki.org/account/OtherHiker',
        },
        { label: 'Anonymous' },
        {
          label: 'Invalid|Title',
          url: 'https://maps.hitchwiki.org/account/Invalid%7CTitle',
        },
      ],
    },
  ],
};
const fetchMock = jest.fn();
const originalFetch = global.fetch;
const values = (locations: CircleLocation[]) => locations[0].facts![1].value;
beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock.mockReset();
});
afterEach(() => jest.useRealTimers());
afterAll(() => {
  global.fetch = originalFetch;
});

it('prefers existing normalised wiki user pages and caches missing pages', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      query: {
        normalized: [{ from: 'User:example hiker', to: 'User:Example hiker' }],
        pages: [
          { title: 'User:Example hiker' },
          { title: 'User:OtherHiker', missing: true },
        ],
      },
    }),
  });
  const { result, rerender } = renderHook(
    ({ locations }) => useHitchwikiProfiles(locations),
    { initialProps: { locations: [location, location] } },
  );
  await waitFor(() =>
    expect(values(result.current)).toEqual([
      {
        label: 'example hiker',
        url: 'https://hitchwiki.org/en/User%3AExample_hiker',
      },
      {
        label: 'OtherHiker',
        url: 'https://maps.hitchwiki.org/account/OtherHiker',
      },
      { label: 'Anonymous' },
      {
        label: 'Invalid|Title',
        url: 'https://maps.hitchwiki.org/account/Invalid%7CTitle',
      },
    ]),
  );
  const url = new URL(fetchMock.mock.calls[0][0]);
  expect(url.searchParams.get('titles')).toBe(
    'User:example hiker|User:OtherHiker',
  );
  expect(fetchMock.mock.calls[0][1]).toEqual({
    credentials: 'omit',
    signal: expect.any(AbortSignal),
  });
  rerender({ locations: [{ ...location }] });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it.each([
  { ok: false },
  { ok: true, json: async () => ({}) },
  {
    ok: true,
    json: async () => ({
      query: { pages: [{ title: 'User:OtherHiker', invalid: true }] },
    }),
  },
])(
  'retains Maps links for unavailable or invalid pages: %j',
  async response => {
    fetchMock.mockResolvedValue(response);
    const { result } = renderHook(() => useHitchwikiProfiles([location]));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(values(result.current)).toEqual(location.facts![1].value);
  },
);

it('does not query locations without named hitchhikers', () => {
  const locations = [
    { ...location, facts: undefined },
    {
      ...location,
      facts: [{ label: 'Hitchhikers', value: [{ label: 'Anonymous' }] }],
    },
  ];
  const { result } = renderHook(() => useHitchwikiProfiles(locations));
  expect(result.current).toEqual(locations);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('does not treat inherited object properties as cached profile URLs', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
  const unusual: CircleLocation = {
    ...location,
    facts: [
      {
        label: 'Hitchhikers',
        value: [
          {
            label: 'constructor',
            url: 'https://maps.hitchwiki.org/account/constructor',
          },
        ],
      },
    ],
  };
  const { result } = renderHook(() => useHitchwikiProfiles([unusual]));
  expect(result.current).toEqual([unusual]);
  await act(async () => {});
  expect(result.current).toEqual([unusual]);
});

it('aborts timed-out lookups and retains Maps links', async () => {
  jest.useFakeTimers();
  fetchMock.mockImplementation(
    (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')));
      }),
  );
  const { result } = renderHook(() => useHitchwikiProfiles([location]));
  await act(async () => jest.advanceTimersByTime(5000));
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  expect(values(result.current)).toEqual(location.facts![1].value);
});

it('aborts pending lookups on unmount and ignores late responses', async () => {
  let resolve!: (value: unknown) => void;
  fetchMock.mockReturnValue(
    new Promise(done => {
      resolve = done;
    }),
  );
  const { unmount } = renderHook(() => useHitchwikiProfiles([location]));
  const signal = fetchMock.mock.calls[0][1].signal;
  unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => resolve({ ok: true, json: async () => ({}) }));
});

it('queries at most fifty names per request', async () => {
  const many: CircleLocation = {
    ...location,
    facts: [
      {
        label: 'Hitchhikers',
        value: Array.from({ length: 51 }, (_, index) => ({
          label: `Hiker${index}`,
          url: `https://maps.hitchwiki.org/account/Hiker${index}`,
        })),
      },
    ],
  };
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
  renderHook(() => useHitchwikiProfiles([many]));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(
    new URL(fetchMock.mock.calls[0][0]).searchParams.get('titles')!.split('|'),
  ).toHaveLength(50);
  expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get('titles')).toBe(
    'User:Hiker50',
  );
});
