import type { MockedFunction } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import '@/config/client/i18n';
import SearchPage from '@/modules/search/client/components/SearchPage.component';
import type SearchMap from '@/modules/search/client/components/SearchMap.component';
import * as locationApiModule from '@/modules/core/client/api/location.api';
import * as tribesApiModule from '@/modules/tribes/client/api/tribes.api';
import * as offersApiModule from '@/modules/offers/client/api/offers.api';
import type { SearchResultOffer } from '@/modules/search/client/components/SearchSidebarResults.component';
import type { Event as NostrEvent } from 'nostr-tools';
import type { TribeSummary } from '@/modules/tribes/client/api/tribes.api';
import type { MapPoint } from '@/modules/core/client/utils/location';
import type { OfferReadPayload } from '@/modules/offers/shared/offer';
import { fakeAnalytics } from '@/testutils/client/analytics.testutil';

type SearchMapProps = React.ComponentProps<typeof SearchMap>;
type SearchMapHarnessProps = Pick<
  SearchMapProps,
  | 'filters'
  | 'isUserPublic'
  | 'location'
  | 'locationBounds'
  | 'onApproximateLocation'
  | 'onDeviceLocation'
  | 'onDeviceLocationRequest'
> & {
  onOfferOpen: (offer: Partial<SearchResultOffer>, recenter?: boolean) => void;
  onCommunityNoteOpen: (note: {
    notes: Partial<NostrEvent>[];
    plusCode: string | null;
  }) => void;
  onVisibleOffersChange: NonNullable<SearchMapProps['onVisibleOffersChange']>;
  onOfferClose: () => void;
};
type LocationSuggestions = Awaited<
  ReturnType<typeof locationApiModule.fetchLocationSuggestions>
>;
// SearchPage tests include a zoom value on located centres, which the map
// consumes even though the location API's public result type omits it.
type SearchPageLocation =
  | ReturnType<typeof locationApiModule.locatePlace>
  | { data: MapPoint & { zoom: number }; type: 'center' };
const locationApi = {
  ...vi.mocked(locationApiModule),
  locatePlace: vi.mocked(locationApiModule.locatePlace) as MockedFunction<
    (
      feature: Parameters<typeof locationApiModule.locatePlace>[0],
    ) => SearchPageLocation
  >,
};
const tribesApi = vi.mocked(tribesApiModule);
const offersApi = vi.mocked(offersApiModule);
const analytics = fakeAnalytics();

const sampleTribe = (id: string, slug: string): TribeSummary => ({
  _id: id,
  slug,
  label: 'Sample Circle',
  count: 1,
});

vi.mock('@tanstack/react-router', async () =>
  (
    await import('@/testutils/client/router-location.testutil')
  ).mockRouterModule(),
);
vi.mock('@/modules/core/client/api/location.api');
vi.mock('@/modules/tribes/client/api/tribes.api');
vi.mock('@/modules/offers/client/api/offers.api');

vi.mock('@/modules/core/client/hooks/use-debounced-callback', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    __esModule: true,
    default: <Callback extends (...args: never[]) => unknown>(
      callback: Callback,
    ): Callback => {
      const callbackRef = React.useRef(callback);
      callbackRef.current = callback;

      const stable = React.useCallback(
        (...args: Parameters<Callback>) => callbackRef.current(...args),
        [],
      );

      return stable as Callback;
    },
  };
});

vi.mock(
  '@/modules/search/client/components/SearchTypesToggle.component',
  () => ({
    __esModule: true,
    default: ({
      onChange,
      types,
    }: {
      onChange: (types: string[]) => void;
      types: Array<string | { id: string }>;
    }) => (
      <button
        data-types={types.join(',')}
        onClick={() => onChange(['meet'])}
        type="button"
      >
        Types toggle
      </button>
    ),
  }),
);

vi.mock(
  '@/modules/search/client/components/SearchCirclesToggle.component',
  () => ({
    __esModule: true,
    default: ({ onChange }: { onChange: (tribes: string[]) => void }) => (
      <button
        type="button"
        onClick={() => onChange(['665100000000000000000002'])}
      >
        Select example circle
      </button>
    ),
  }),
);

vi.mock(
  '@/modules/search/client/components/SearchMyCirclesToggle.component',
  () => ({
    __esModule: true,
    default: () => <div data-testid="my-circles-toggle" />,
  }),
);

vi.mock(
  '@/modules/search/client/components/SearchFilterLanguage.component',
  () => ({
    __esModule: true,
    default: ({
      onChangeLanguages,
    }: {
      onChangeLanguages: (languages: string[]) => void;
    }) => (
      <button onClick={() => onChangeLanguages(['fi'])} type="button">
        Language filter
      </button>
    ),
  }),
);

vi.mock('@/modules/core/client/api/languages.api', () => ({
  useLanguagesQuery: () => ({ data: { en: 'English', fi: 'Finnish' } }),
}));

vi.mock('@/modules/users/client/components/Avatar.component', () => ({
  __esModule: true,
  default: () => <span data-testid="avatar" />,
}));

vi.mock(
  '@/modules/search/client/components/CommunityNotesSidebar.component',
  () => ({
    __esModule: true,
    default: ({ plusCode }: { plusCode: string | null }) => (
      <div data-testid="community-notes-sidebar">{plusCode}</div>
    ),
  }),
);

let searchMapProps: SearchMapHarnessProps = {
  filters: '{}',
  isUserPublic: false,
  onOfferOpen: () => {},
  onCommunityNoteOpen: () => {},
  onVisibleOffersChange: () => {},
  onOfferClose: () => {},
};

const mockOffer: SearchResultOffer & {
  _id: string;
  location: [number, number];
  user: SearchResultOffer['user'] & { _id: string };
} = {
  _id: '665100000000000000000001',
  type: 'host',
  status: 'yes',
  description: 'Welcome',
  location: [60.17, 24.94],
  user: {
    _id: 'member-1',
    username: 'hoster',
    displayName: 'Host Person',
    birthdate: '1990-05-15T00:00:00.000Z',
    gender: 'female',
    languages: ['en'],
  },
};

// Render the SearchMap double synchronously instead of through React.lazy.
vi.mock('@/modules/core/client/components/lazyMap', async () => {
  const { default: SearchMapDouble } =
    await import('@/modules/search/client/components/SearchMap.component');
  return { default: () => SearchMapDouble };
});
vi.mock('@/modules/search/client/components/SearchMap.component', () => ({
  __esModule: true,
  default: (props: SearchMapHarnessProps) => {
    searchMapProps = props;

    return (
      <div data-testid="search-map">
        <button
          onClick={() => props.onOfferOpen(mockOffer, true)}
          type="button"
        >
          Preview offer
        </button>
        <button onClick={() => props.onOfferOpen(mockOffer)} type="button">
          Preview offer without recenter
        </button>
        <button
          onClick={() =>
            props.onOfferOpen({ ...mockOffer, _id: undefined }, false)
          }
          type="button"
        >
          Preview offer without an ID
        </button>
        <button
          onClick={() => props.onOfferOpen({ _id: 'invalid-offer' })}
          type="button"
        >
          Preview invalid offer
        </button>
        <button
          onClick={() =>
            props.onCommunityNoteOpen({
              notes: [{ id: 'note-1' }],
              plusCode: '9F2X+XX',
            })
          }
          type="button"
        >
          Preview community note
        </button>
        <button
          onClick={() =>
            props.onVisibleOffersChange?.(['665100000000000000000001'])
          }
          type="button"
        >
          Report visible offer
        </button>
        <button onClick={() => props.onOfferClose()} type="button">
          Close offer
        </button>
        <button
          onClick={() => {
            props.onDeviceLocationRequest?.();
            props.onDeviceLocation?.({ lat: 0, lng: 0 });
          }}
          type="button"
        >
          Use my location
        </button>
        <button
          onClick={() => {
            props.onDeviceLocationRequest?.();
            props.onApproximateLocation?.({
              latitude: 12,
              longitude: 23,
              zoom: 5,
            });
          }}
          type="button"
        >
          Use approximate location
        </button>
      </div>
    );
  },
}));

function renderSearchPage(
  user: React.ComponentProps<typeof SearchPage>['user'] = {
    _id: 'user-1',
    public: true,
  },
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SearchPage user={user} />
    </QueryClientProvider>,
    { wrapper: analytics.wrapper },
  );
}

function openResultsWithVisibleOfferIds(offerIds: string[]) {
  fireEvent.click(screen.getByRole('tab', { name: /^results$/i }));
  act(() => searchMapProps.onVisibleOffersChange(offerIds));
}

describe('<SearchPage />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchMapProps = {
      filters: '{}',
      isUserPublic: false,
      onOfferOpen: () => {},
      onCommunityNoteOpen: () => {},
      onVisibleOffersChange: () => {},
      onOfferClose: () => {},
    };
    window.localStorage.clear();
    window.history.pushState({}, '', '/search');
    locationApi.fetchLocationSuggestions.mockResolvedValue([]);
    locationApi.locatePlace.mockReturnValue(null);
    tribesApi.get.mockResolvedValue(sampleTribe('circle-1', 'sample-circle'));
    offersApi.getOffer.mockResolvedValue(mockOffer);

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1024,
      writable: true,
    });
  });

  it('renders the map shell and sidebar for public members on desktop', () => {
    renderSearchPage();

    expect(screen.getByTestId('search-map')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /hide search filters/i }),
    ).toBeInTheDocument();
    expect(document.querySelector('.search.is-sidebar-open')).toBeTruthy();
  });

  it('loads visible offer cards when Results opens and returns from details', async () => {
    renderSearchPage();

    fireEvent.click(
      screen.getByRole('button', { name: 'Report visible offer' }),
    );
    openResultsWithVisibleOfferIds([mockOffer._id]);

    const resultButton = await screen.findByRole('button', {
      name: /open hosting offer from host person/i,
    });
    expect(offersApi.getOffer).toHaveBeenCalledWith(mockOffer._id);

    fireEvent.click(resultButton);
    expect(
      await screen.findByRole('link', { name: /host person/i }),
    ).toHaveAttribute('href', '/profile/hoster');

    fireEvent.click(screen.getByRole('button', { name: 'Back to results' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: /open hosting offer from host person/i,
        }),
      ).toHaveFocus(),
    );
    expect(offersApi.getOffer).toHaveBeenCalledTimes(1);
  });

  it('evicts the oldest offer from its cache after 250 entries', async () => {
    const offerIds = Array.from({ length: 251 }, (_, index) =>
      String(index + 1).padStart(24, '0'),
    );
    offersApi.getOffer.mockImplementation(async id => ({
      ...mockOffer,
      _id: id,
      user: { ...mockOffer.user, displayName: `Host ${id}` },
    }));

    renderSearchPage();
    openResultsWithVisibleOfferIds(offerIds);

    await waitFor(() =>
      expect(offersApi.getOffer).toHaveBeenCalledTimes(offerIds.length),
    );
    expect(
      screen.getAllByRole('button', { name: /open hosting offer/i }),
    ).toHaveLength(offerIds.length);

    act(() => searchMapProps.onVisibleOffersChange([offerIds[0]]));
    await waitFor(() =>
      expect(offersApi.getOffer).toHaveBeenCalledTimes(offerIds.length + 1),
    );
  });

  it('shows an empty state when a visible offer detail cannot be loaded', async () => {
    offersApi.getOffer.mockRejectedValueOnce(new Error('Not found'));
    renderSearchPage();

    fireEvent.click(
      screen.getByRole('button', { name: 'Report visible offer' }),
    );
    fireEvent.click(screen.getByRole('tab', { name: /^results$/i }));

    expect(
      await screen.findByText(/no results are visible in this map area/i),
    ).toBeInTheDocument();
  });

  it('continues to share requests for offers across overlapping viewports', async () => {
    const pending = new Map<string, (offer: OfferReadPayload) => void>();
    offersApi.getOffer.mockImplementation(
      id =>
        new Promise(resolve => {
          pending.set(id, resolve);
        }),
    );

    renderSearchPage();
    openResultsWithVisibleOfferIds(['offer-a', 'offer-b']);
    await waitFor(() => expect(offersApi.getOffer).toHaveBeenCalledTimes(2));

    act(() => searchMapProps.onVisibleOffersChange(['offer-b', 'offer-c']));
    await waitFor(() => expect(offersApi.getOffer).toHaveBeenCalledTimes(3));
    expect(offersApi.getOffer).toHaveBeenCalledWith('offer-b');
    expect(
      offersApi.getOffer.mock.calls.filter(([id]) => id === 'offer-b'),
    ).toHaveLength(1);

    for (const [id, resolve] of pending) {
      resolve({ ...mockOffer, _id: id });
    }

    expect(
      await screen.findAllByRole('button', {
        name: /open hosting offer from host person/i,
      }),
    ).toHaveLength(2);
  });

  it('stops requesting later batches after the results pane unmounts', async () => {
    const pending: Array<(offer: OfferReadPayload) => void> = [];
    offersApi.getOffer.mockImplementation(
      () =>
        new Promise(resolve => {
          pending.push(resolve);
        }),
    );
    const offerIds = Array.from({ length: 17 }, (_, index) => `offer-${index}`);
    const { unmount } = renderSearchPage();

    openResultsWithVisibleOfferIds(offerIds);
    await waitFor(() => expect(offersApi.getOffer).toHaveBeenCalledTimes(8));

    unmount();
    await act(async () => {
      pending.forEach(resolve => Reflect.apply(resolve, undefined, [null]));
      await Promise.resolve();
    });
    expect(offersApi.getOffer).toHaveBeenCalledTimes(8);
  });

  it('skips visible offers when the offer endpoint returns no result', async () => {
    // The endpoint can return no offer for a stale visible result.
    Reflect.apply(offersApi.getOffer.mockResolvedValue, offersApi.getOffer, [
      null,
    ]);
    renderSearchPage();
    openResultsWithVisibleOfferIds(['missing-offer']);

    expect(
      await screen.findByText(/no results are visible in this map area/i),
    ).toBeInTheDocument();
  });

  it('shows the activation message for non-public members', () => {
    renderSearchPage({ _id: 'user-1', public: false });

    expect(
      screen.getByText(/activate your profile before you can browse others/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /hide search filters/i }),
    ).not.toBeInTheDocument();
  });

  it('toggles the sidebar open and closed', () => {
    renderSearchPage();

    fireEvent.click(
      screen.getByRole('button', { name: /hide search filters/i }),
    );

    expect(document.querySelector('.search.is-sidebar-open')).toBeFalsy();
    expect(
      screen.getByRole('button', { name: /open search filters/i }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /open search filters/i }),
    );

    expect(document.querySelector('.search.is-sidebar-open')).toBeTruthy();
  });

  it('opens the filters tab from the mobile toolbar', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 480,
      writable: true,
    });

    renderSearchPage();

    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }));

    expect(document.querySelector('.search.is-sidebar-open')).toBeTruthy();
  });

  it('shows mobile place search and returns to the map', () => {
    renderSearchPage();

    fireEvent.click(screen.getByRole('button', { name: /search places/i }));

    expect(screen.getByLabelText('Search places')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /back to map/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back to map/i }));

    expect(screen.queryByLabelText('Search places')).not.toBeInTheDocument();
  });

  it('initialises tribe filters from the route params', async () => {
    window.history.pushState({}, '', '/search?tribe=cyclists');
    tribesApi.get.mockResolvedValue(sampleTribe('tribe-cyclists', 'cyclists'));

    renderSearchPage();

    await waitFor(() =>
      expect(searchMapProps.filters).toContain('tribe-cyclists'),
    );
    expect(tribesApi.get).toHaveBeenCalledWith('cyclists');

    fireEvent.click(
      screen.getByRole('button', { name: 'Select example circle' }),
    );
    expect(searchMapProps.filters).toContain('665100000000000000000002');
    expect(new URLSearchParams(window.location.search).has('tribe')).toBe(
      false,
    );
  });

  it('initialises the map location from a location query param', async () => {
    window.history.pushState({}, '', '/search?location=Helsinki_Finland');
    const feature = { id: 'place-1', trTitle: 'Helsinki, Finland' };
    locationApi.fetchLocationSuggestions.mockResolvedValue([feature]);
    locationApi.locatePlace.mockReturnValue({
      data: { lat: 60.17, lng: 24.94, zoom: 10 },
      type: 'center',
    });

    renderSearchPage();

    await waitFor(() =>
      expect(searchMapProps.location).toEqual({
        lat: 60.17,
        lng: 24.94,
        zoom: 10,
      }),
    );
    expect(locationApi.fetchLocationSuggestions).toHaveBeenCalledWith(
      'Helsinki Finland',
    );
  });

  it('queries city bounds, keeps filters and restores the list after opening an offer', async () => {
    const feature = {
      id: 'place.sample-harbour',
      trTitle: 'Sample Harbour',
      center: [22, 44],
      bbox: [21, 43, 23, 45],
    };
    locationApi.fetchLocationSuggestions.mockResolvedValue([feature]);
    locationApi.locatePlace.mockReturnValue({
      data: { lat: 44, lng: 22 },
      type: 'center',
    });
    offersApi.queryPlaceHosts.mockResolvedValue({
      offers: [
        {
          ...mockOffer,
          type: 'host',
          age: 35,
          activity: 'past-month',
          experienceCount: 1,
          location: [44, 22],
        },
      ],
    });
    renderSearchPage();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search places' }), {
      target: { value: 'Sample Harbour' },
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Sample Harbour' }),
    );
    const list = await screen.findByRole('table', { name: 'City hosts' });
    expect(new URLSearchParams(window.location.search).get('location')).toBe(
      'Sample Harbour',
    );
    expect(list).toHaveTextContent('Age 35 · Near the centre');
    expect(within(list).getByRole('cell', { name: '1' })).toBeInTheDocument();
    expect(offersApi.queryPlaceHosts).toHaveBeenLastCalledWith(
      expect.objectContaining({
        northEastLat: 45,
        northEastLng: 23,
        southWestLat: 43,
        southWestLng: 21,
        sort: 'name',
      }),
      expect.any(AbortSignal),
    );

    fireEvent.change(screen.getByLabelText('Sort hosts'), {
      target: { value: 'activity' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Can host only' }));
    await waitFor(() =>
      expect(offersApi.queryPlaceHosts).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'activity', canHost: true }),
        expect.any(AbortSignal),
      ),
    );
    const host = await screen.findByRole('button', {
      name: /open hosting offer from Host Person/i,
    });
    fireEvent.click(host);
    expect(
      await screen.findByRole('link', { name: /Host Person/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to results' }));
    expect(
      await screen.findByRole('table', { name: 'City hosts' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Sort hosts')).toHaveValue('activity');
    expect(
      screen.getByRole('checkbox', { name: 'Can host only' }),
    ).toBeChecked();
  });

  it('handles unavailable city pages and offers while keeping the list usable', async () => {
    const feature = {
      id: 'place.sample-harbour',
      trTitle: 'Sample Harbour',
      center: [22, 44],
    };
    const host = {
      ...mockOffer,
      type: 'host' as const,
      activity: 'past-six-months' as const,
      experienceCount: 0,
    };
    locationApi.fetchLocationSuggestions.mockResolvedValue([feature]);
    locationApi.locatePlace.mockReturnValue({
      data: { lat: 44, lng: 22 },
      type: 'center',
    });
    let rejectNextPage!: (error: Error) => void;
    const nextPage = new Promise<never>((_resolve, reject) => {
      rejectNextPage = reject;
    });
    offersApi.queryPlaceHosts
      .mockRejectedValueOnce(new Error('Connection lost'))
      .mockResolvedValueOnce({ offers: [host], nextOffset: 30 })
      .mockReturnValueOnce(nextPage)
      .mockResolvedValueOnce({
        offers: [
          {
            ...host,
            _id: 'another-host',
            status: undefined,
            volunteering: true,
            user: { _id: 'member-2', username: 'another-host' },
          },
        ],
      })
      .mockResolvedValueOnce({ offers: [] });
    offersApi.getOffer.mockRejectedValueOnce(new Error('Offer unavailable'));
    renderSearchPage();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search places' }), {
      target: { value: feature.trTitle },
    });
    fireEvent.click(
      await screen.findByRole('button', { name: feature.trTitle }),
    );
    expect(screen.getByText('Loading hosts…')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    const list = await screen.findByRole('table', { name: 'City hosts' });
    expect(within(list).getByRole('cell', { name: '0' })).toBeInTheDocument();
    expect(list).toHaveTextContent(/About \d+ km from centre/);
    fireEvent.click(screen.getByRole('button', { name: 'Load more hosts' }));
    expect(
      await screen.findByRole('button', { name: 'Loading hosts…' }),
    ).toBeDisabled();
    await act(async () => rejectNextPage(new Error('Connection lost')));
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(
      await within(list).findByRole('button', { name: /another-host/ }),
    ).toBeInTheDocument();
    expect(within(list).getByText('Offers volunteering')).toBeInTheDocument();
    expect(offersApi.queryPlaceHosts).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 30 }),
      expect.any(AbortSignal),
    );

    fireEvent.click(
      within(list).getByRole('button', {
        name: /open hosting offer from Host Person/i,
      }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This offer could not be opened',
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Results in this map area' }),
    );
    expect(
      screen.queryByRole('table', { name: 'City hosts' }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Hosts in Sample Harbour' }),
    );
    expect(
      await screen.findByRole('table', { name: 'City hosts' }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Active in the past six months' }),
    );
    expect(
      await screen.findByText(
        'No hosts match these filters in Sample Harbour.',
      ),
    ).toBeInTheDocument();
    expect(offersApi.queryPlaceHosts).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filters: expect.stringContaining('"months":24'),
      }),
      expect.any(AbortSignal),
    );
  });

  it.each([false, true])(
    'ignores a city preview that settles after closing the mobile pane (fails: %s)',
    async fails => {
      window.innerWidth = 390;
      const feature = {
        id: 'place.sample-harbour',
        trTitle: 'Sample Harbour',
        center: [22, 44],
      };
      locationApi.fetchLocationSuggestions.mockResolvedValue([feature]);
      locationApi.locatePlace.mockReturnValue({
        data: { lat: 44, lng: 22 },
        type: 'center',
      });
      offersApi.queryPlaceHosts.mockResolvedValue({
        offers: [
          {
            ...mockOffer,
            type: 'host',
            activity: 'past-month',
            experienceCount: 2,
          },
        ],
      });

      let finish!: () => void;
      offersApi.getOffer.mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            finish = () => {
              if (fails) reject(new Error('Offer unavailable'));
              else resolve(mockOffer);
            };
          }),
      );
      renderSearchPage();

      fireEvent.click(screen.getByRole('button', { name: 'Search places' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Search places' }), {
        target: { value: feature.trTitle },
      });
      fireEvent.click(
        await screen.findByRole('button', { name: feature.trTitle }),
      );
      fireEvent.click(
        await screen.findByRole('button', {
          name: /open hosting offer from Host Person/i,
        }),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Back to map' }));
      await act(async () => finish());

      fireEvent.click(screen.getByRole('button', { name: /^Hosts$/ }));
      expect(
        await screen.findByRole('table', { name: 'City hosts' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );

  it('keeps a deep-linked offer when the URL also specifies a city', async () => {
    window.history.pushState(
      {},
      '',
      `/search?location=Sample+Harbour&offer=${mockOffer._id}`,
    );
    locationApi.fetchLocationSuggestions.mockResolvedValue([
      {
        id: 'place.sample-harbour',
        trTitle: 'Sample Harbour',
        center: [22, 44],
      },
    ]);
    locationApi.locatePlace.mockReturnValue({
      data: { lat: 44, lng: 22 },
      type: 'center',
    });
    offersApi.queryPlaceHosts.mockResolvedValue({ offers: [] });

    renderSearchPage();
    expect(
      await screen.findByRole('link', { name: /Host Person/ }),
    ).toBeInTheDocument();
    expect(new URL(window.location.href).searchParams.get('offer')).toBe(
      mockOffer._id,
    );
    expect(searchMapProps.location).toMatchObject({
      lat: mockOffer.location![0],
      lng: mockOffer.location![1],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Back to results' }));
    expect(
      await screen.findByRole('heading', { name: 'Hosts in Sample Harbour' }),
    ).toBeInTheDocument();
  });

  it('keeps the map usable when a legacy circle cannot be loaded', async () => {
    window.history.pushState({}, '', '/search?tribe=missing-circle');
    const lookup = Promise.reject(new Error('Circle not found'));
    tribesApi.get.mockReturnValue(lookup);

    renderSearchPage();
    await act(async () => {
      await lookup.catch(() => undefined);
    });

    expect(tribesApi.get).toHaveBeenCalledWith('missing-circle');
    expect(JSON.parse(searchMapProps.filters).tribes).toEqual([]);
  });

  it('prioritises a shared offer over the shared place viewport', async () => {
    const offerId = '665100000000000000000001';
    window.history.pushState(
      {},
      '',
      `/search?offer=${offerId}&location=Exampleville`,
    );
    offersApi.getOffer.mockResolvedValue(mockOffer);
    locationApi.fetchLocationSuggestions.mockResolvedValue([
      { id: 'place-1', trTitle: 'Exampleville' },
    ]);
    locationApi.locatePlace.mockReturnValue({
      data: { lat: 12, lng: 34, zoom: 10 },
      type: 'center',
    });

    renderSearchPage();

    await waitFor(() => {
      expect(offersApi.getOffer).toHaveBeenCalledWith(offerId);
    });

    expect(
      await screen.findByRole('link', { name: /host person/i }),
    ).toBeInTheDocument();
    expect(locationApi.locatePlace).toHaveBeenCalled();
    expect(searchMapProps.location).toMatchObject({
      lat: mockOffer.location![0],
      lng: mockOffer.location![1],
    });
    expect(analytics.track).toHaveBeenCalledWith('search_offer_previewed');
  });

  it('tracks missing offers loaded from the route params', async () => {
    window.history.pushState({}, '', '/search?offer=665100000000000000000099');
    offersApi.getOffer.mockRejectedValue(new Error('not found'));

    renderSearchPage();

    await waitFor(() => {
      expect(analytics.track).toHaveBeenCalledWith('search_offer_not_found');
    });
  });

  it('previews offers and community notes from map callbacks', async () => {
    renderSearchPage();

    fireEvent.click(screen.getByRole('button', { name: 'Preview offer' }));

    expect(
      await screen.findByRole('link', { name: /host person/i }),
    ).toBeInTheDocument();
    expect(
      document.querySelector('.search-sidebar-container.is-offer-open'),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: /preview community note/i }),
    );

    expect(screen.getByTestId('community-notes-sidebar')).toHaveTextContent(
      '9F2X+XX',
    );
    expect(analytics.track).toHaveBeenCalledWith(
      'search_community_note_opened',
    );

    fireEvent.click(screen.getByRole('button', { name: /close offer/i }));
  });

  it('ignores map offers without a location', () => {
    renderSearchPage();

    fireEvent.click(
      screen.getByRole('button', { name: /preview invalid offer/i }),
    );

    expect(
      screen.queryByRole('link', { name: /host person/i }),
    ).not.toBeInTheDocument();
  });

  it('initialises bounds from a location query', async () => {
    window.history.pushState({}, '', '/search?location=Helsinki_Finland');
    locationApi.fetchLocationSuggestions.mockResolvedValue([
      { id: 'place-2', trTitle: 'Helsinki, Finland' },
    ]);
    locationApi.locatePlace.mockReturnValue({
      data: {
        northEast: { lat: 61, lng: 25 },
        southWest: { lat: 60, lng: 24 },
      },
      type: 'bounds',
    });

    renderSearchPage();

    await waitFor(() => {
      expect(searchMapProps.locationBounds).toEqual({
        northEast: { lat: 61, lng: 25 },
        southWest: { lat: 60, lng: 24 },
      });
    });
  });

  it('uses device coordinates, clears selected content and removes the old location query', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('location', 'Helsinki_Finland');
    url.searchParams.set('communityNotes', 'true');
    window.history.replaceState({}, '', url);
    renderSearchPage();

    fireEvent.click(screen.getByRole('button', { name: 'Preview offer' }));
    expect(
      screen.getByRole('link', { name: /host person/i }),
    ).toBeInTheDocument();
    const filtersBeforeLocation = searchMapProps.filters;

    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));

    expect(searchMapProps.location).toEqual({
      lat: 0,
      lng: 0,
      zoom: 13,
      clearSelection: true,
    });
    expect(searchMapProps.locationBounds).toEqual({});
    expect(searchMapProps.filters).toBe(filtersBeforeLocation);
    expect(
      screen.queryByRole('link', { name: /host person/i }),
    ).not.toBeInTheDocument();
    expect(new URL(window.location.href).searchParams.has('location')).toBe(
      false,
    );
  });

  it('uses an approximate location at its coarse zoom without changing filters', () => {
    renderSearchPage();
    const filtersBeforeLocation = searchMapProps.filters;

    fireEvent.click(
      screen.getByRole('button', { name: 'Use approximate location' }),
    );

    expect(searchMapProps.location).toEqual({
      lat: 12,
      lng: 23,
      zoom: 5,
      clearSelection: true,
    });
    expect(searchMapProps.locationBounds).toEqual({});
    expect(searchMapProps.filters).toBe(filtersBeforeLocation);
  });

  it('does not apply an initial place lookup after device location succeeds', async () => {
    window.history.pushState({}, '', '/search?location=Paris');
    const pendingSuggestions: Array<
      (suggestions: LocationSuggestions) => void
    > = [];
    locationApi.fetchLocationSuggestions.mockImplementation(
      () =>
        new Promise(resolve => {
          pendingSuggestions.push(resolve);
        }),
    );
    locationApi.locatePlace.mockReturnValue({
      data: { lat: 48.8566, lng: 2.3522, zoom: 10 },
      type: 'center',
    });

    renderSearchPage();
    await waitFor(() => expect(pendingSuggestions.length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));

    await act(async () => {
      pendingSuggestions.forEach(resolve =>
        resolve([{ id: 'place-paris', trTitle: 'Paris, France' }]),
      );
    });

    expect(searchMapProps.location).toEqual({
      lat: 0,
      lng: 0,
      zoom: 13,
      clearSelection: true,
    });
    expect(searchMapProps.locationBounds).toEqual({});
  });

  it('updates sidebar filters from the filters panel', () => {
    window.history.replaceState({}, '', '/search?other=1#existing');
    renderSearchPage();

    fireEvent.click(screen.getByRole('button', { name: /types toggle/i }));
    expect(searchMapProps.filters).toContain('"types":["meet"]');

    fireEvent.click(screen.getByRole('checkbox', { name: /community notes/i }));
    expect(searchMapProps.filters).toContain('"communityNotes":false');

    fireEvent.click(
      screen.getByRole('checkbox', { name: /online in the past 6 months/i }),
    );
    expect(searchMapProps.filters).toContain('"months":24');

    fireEvent.click(screen.getByRole('button', { name: /language filter/i }));
    expect(searchMapProps.filters).toContain('"fi"');
    const { searchParams, hash } = new URL(window.location.href);
    expect(hash).toBe('#existing');
    expect(searchParams.get('other')).toBe('1');
    expect(JSON.parse(searchParams.get('filters')!)).toMatchObject({
      types: ['meet'],
      communityNotes: false,
      seen: { months: 24 },
      languages: ['fi'],
    });
  });

  it('restores a shared filter URL and updates the same map on history navigation', () => {
    window.localStorage.setItem(
      'search.filters.user-1',
      JSON.stringify({ types: ['meet'], communityNotes: true }),
    );
    const url = new URL(window.location.href);
    url.searchParams.set(
      'filters',
      JSON.stringify({
        types: ['host'],
        communityNotes: false,
        connectionsOnly: true,
        volunteering: true,
      }),
    );
    window.history.replaceState({}, '', url);
    renderSearchPage();

    const connections = screen.getByRole('checkbox', {
      name: 'My connections only',
    });
    expect(connections).toBeChecked();
    expect(JSON.parse(searchMapProps.filters)).toMatchObject({
      types: ['host'],
      communityNotes: false,
      volunteering: true,
    });

    act(() => {
      window.history.replaceState({}, '', '/search');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(connections).not.toBeChecked();
    expect(JSON.parse(searchMapProps.filters)).toMatchObject({
      types: ['meet'],
      communityNotes: true,
    });
  });

  it.each([
    'default',
    'pending legacy circle',
    'resolved legacy circle',
    'shared filters',
  ])('writes and clears a selected place with %s', async scenario => {
    window.localStorage.setItem(
      'search.filters.user-1',
      JSON.stringify({ connectionsOnly: true }),
    );
    const params = new URLSearchParams();
    if (scenario !== 'default') params.set('tribe', 'cyclists');
    if (scenario === 'shared filters') {
      params.set('filters', JSON.stringify({ connectionsOnly: true }));
    }
    if (scenario === 'pending legacy circle') {
      tribesApi.get.mockReturnValue(new Promise(() => {}));
    }
    if (scenario === 'resolved legacy circle') {
      tribesApi.get.mockResolvedValue(
        sampleTribe('tribe-cyclists', 'cyclists'),
      );
    }
    window.history.replaceState({}, '', `/search?${params}`);
    renderSearchPage();
    if (scenario === 'resolved legacy circle') {
      await waitFor(() =>
        expect(searchMapProps.filters).toContain('tribe-cyclists'),
      );
    }
    const title = 'Exampleville, Example County';
    locationApi.fetchLocationSuggestions.mockResolvedValue([
      { id: 'place-1', trTitle: title },
    ]);
    locationApi.locatePlace.mockReturnValue({
      data: { lat: 12, lng: 34, zoom: 10 },
      type: 'center',
    });

    fireEvent.change(screen.getByLabelText('Search places'), {
      target: { value: 'Exampleville' },
    });
    fireEvent.click(await screen.findByRole('button', { name: title }));
    expect(new URL(window.location.href).searchParams.get('location')).toBe(
      title,
    );
    const selectedParams = new URLSearchParams(window.location.search);
    if (scenario === 'pending legacy circle') {
      expect(selectedParams.get('tribe')).toBe('cyclists');
      expect(selectedParams.has('filters')).toBe(false);
    } else {
      expect(JSON.parse(selectedParams.get('filters')!)).toMatchObject({
        connectionsOnly: true,
        ...(scenario === 'resolved legacy circle' && {
          tribes: ['tribe-cyclists'],
        }),
      });
    }
    expect(searchMapProps.location).toEqual({ lat: 12, lng: 34, zoom: 10 });

    fireEvent.click(
      screen.getByRole('button', { name: 'Clear location search' }),
    );
    expect(new URL(window.location.href).searchParams.has('location')).toBe(
      false,
    );
  });

  it('keeps the map position when previewing an offer without recentering', async () => {
    renderSearchPage();

    fireEvent.click(
      screen.getByRole('button', { name: 'Preview offer without recenter' }),
    );

    expect(
      await screen.findByRole('link', { name: /host person/i }),
    ).toBeInTheDocument();
    expect(searchMapProps.location).toEqual({});
  });

  it('previews a located offer when it has no ID', async () => {
    renderSearchPage();

    fireEvent.click(
      screen.getByRole('button', { name: 'Preview offer without an ID' }),
    );

    expect(
      await screen.findByRole('link', { name: /host person/i }),
    ).toBeInTheDocument();
    expect(new URL(window.location.href).searchParams.has('offer')).toBe(false);
    expect(searchMapProps.location).toEqual({});
  });

  it('does not reload a pin preview when its offer ID is written to the URL', async () => {
    window.history.replaceState({}, '', '/search');
    offersApi.getOffer.mockClear();

    renderSearchPage();

    fireEvent.click(
      screen.getByRole('button', { name: 'Preview offer without recenter' }),
    );

    expect(
      await screen.findByRole('link', { name: /host person/i }),
    ).toBeInTheDocument();
    expect(new URL(window.location.href).searchParams.get('offer')).toBe(
      mockOffer._id,
    );
    expect(offersApi.getOffer).not.toHaveBeenCalled();
    expect(searchMapProps.location).toEqual({});
  });

  it('uses the six-month filter value after toggling it twice', () => {
    renderSearchPage();

    const checkbox = screen.getByRole('checkbox', {
      name: /online in the past 6 months/i,
    });
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);

    expect(searchMapProps.filters).toContain('"months":6');
  });

  it('ignores URL data that resolves after the page unmounts', async () => {
    let resolveTribe!: (tribe: TribeSummary) => void;
    window.history.pushState({}, '', '/search?tribe=cyclists');
    tribesApi.get.mockReturnValue(
      new Promise(resolve => {
        resolveTribe = resolve;
      }),
    );

    const { unmount } = renderSearchPage();
    unmount();
    resolveTribe(sampleTribe('tribe-cyclists', 'cyclists'));

    await new Promise(resolve => setTimeout(resolve, 0));
  });

  it('ignores location suggestions that resolve after the page unmounts', async () => {
    let resolveSuggestions!: (suggestions: LocationSuggestions) => void;
    window.history.pushState({}, '', '/search?location=Helsinki_Finland');
    locationApi.fetchLocationSuggestions.mockReturnValue(
      new Promise(resolve => {
        resolveSuggestions = resolve;
      }),
    );

    const { unmount } = renderSearchPage();
    unmount();
    resolveSuggestions([{ id: 'place-1', trTitle: 'Helsinki, Finland' }]);

    await new Promise(resolve => setTimeout(resolve, 0));
  });

  it('does not use an unlocatable location suggestion', async () => {
    window.history.pushState({}, '', '/search?location=Helsinki_Finland');
    locationApi.fetchLocationSuggestions.mockResolvedValue([
      { id: 'place-1', trTitle: 'Helsinki, Finland' },
    ]);
    locationApi.locatePlace.mockReturnValue(null);

    renderSearchPage();

    await waitFor(() => {
      expect(locationApi.fetchLocationSuggestions).toHaveBeenCalled();
    });
    expect(searchMapProps.location).toEqual({});
  });

  it('ignores offer results and failures that arrive after unmount', async () => {
    let resolveOffer!: (offer: OfferReadPayload) => void;
    const offerId = '665100000000000000000001';
    window.history.pushState({}, '', `/search?offer=${offerId}`);
    offersApi.getOffer.mockReturnValue(
      new Promise(resolve => {
        resolveOffer = resolve;
      }),
    );

    const firstRender = renderSearchPage();
    firstRender.unmount();
    resolveOffer(mockOffer);
    await new Promise(resolve => setTimeout(resolve, 0));

    let rejectOffer!: (reason: Error) => void;
    offersApi.getOffer.mockReturnValue(
      new Promise((resolve, reject) => {
        rejectOffer = reject;
      }),
    );
    const secondRender = renderSearchPage();
    secondRender.unmount();
    rejectOffer(new Error('late failure'));
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  it('ignores malformed offer identifiers in the route', () => {
    window.history.pushState({}, '', '/search?offer=invalid');
    renderSearchPage();
    expect(offersApi.getOffer).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Members' })).toHaveAttribute(
      'href',
      '/search/members',
    );
  });

  it('passes public visibility through to the map', () => {
    renderSearchPage({ _id: 'user-1', public: true });

    expect(searchMapProps.isUserPublic).toBe(true);
  });

  it('initialises search filters for signed-out visitors', () => {
    renderSearchPage(null);

    expect(screen.getByTestId('search-map')).toBeInTheDocument();
    expect(searchMapProps.isUserPublic).toBe(false);
  });

  it('switches to the results tab when previewing map content', async () => {
    renderSearchPage();

    fireEvent.click(screen.getByRole('button', { name: 'Preview offer' }));

    const resultsTab = await screen.findByRole('tab', { name: /^results$/i });
    expect(resultsTab).toHaveAttribute('aria-selected', 'true');
  });

  it('switches between the filters and results tabs directly', () => {
    renderSearchPage();

    const filtersTab = screen.getByRole('tab', { name: /filters/i });
    const resultsTab = screen.getByRole('tab', { name: /^results$/i });

    fireEvent.click(filtersTab);
    expect(filtersTab).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(resultsTab);
    expect(resultsTab).toHaveAttribute('aria-selected', 'true');
  });

  it('closes the sidebar from the filters back button on small screens', () => {
    renderSearchPage();

    const sidebar = document.querySelector('.search-sidebar-container');
    if (!(sidebar instanceof HTMLElement)) {
      throw new Error('Expected the search sidebar to be rendered');
    }
    const backButtons = within(sidebar).getAllByRole('button', {
      name: /back to map/i,
    });

    fireEvent.click(backButtons[0]);

    expect(document.querySelector('.search.is-sidebar-open')).toBeFalsy();
  });
});
