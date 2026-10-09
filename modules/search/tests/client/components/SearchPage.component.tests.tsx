import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import SearchPage from '@/modules/search/client/components/SearchPage.component';
import type SearchMap from '@/modules/search/client/components/SearchMap.component';
import * as locationApiModule from '@/modules/search/client/api/location.api';
import * as tribesApiModule from '@/modules/tribes/client/api/tribes.api';
import * as offersApiModule from '@/modules/offers/client/api/offers.api';
import type { SearchResultOffer } from '@/modules/search/client/components/SearchSidebarResults.component';
import type { Event as NostrEvent } from 'nostr-tools';
import type { TribeSummary } from '@/modules/tribes/client/api/tribes.api';
import type { MapPoint } from '@/modules/search/client/utils/location';
import type { Offer } from '@/modules/offers/client/api/offers.api';

type SearchMapProps = React.ComponentProps<typeof SearchMap>;
type SearchMapHarnessProps = Pick<
  SearchMapProps,
  'filters' | 'isUserPublic' | 'location' | 'locationBounds'
> & {
  onOfferOpen: (offer: Partial<SearchResultOffer>, recenter?: boolean) => void;
  onCommunityNoteOpen: (note: {
    notes: Partial<NostrEvent>[];
    plusCode: string | null;
  }) => void;
  onVisibleOffersChange: NonNullable<SearchMapProps['onVisibleOffersChange']>;
  onOfferClose: () => void;
};
type RouteParams = Record<string, string>;
type LocationSuggestions = Awaited<
  ReturnType<typeof locationApiModule.fetchLocationSuggestions>
>;
const mockEventTrack = jest.fn<
  undefined,
  [
    action: string,
    options?: { category?: string; label?: string; value?: string | number },
  ]
>();
const mockGetRouteParams = jest.fn<RouteParams, []>();
// SearchPage tests include a zoom value on located centres, which the map
// consumes even though the location API's public result type omits it.
type SearchPageLocation =
  | ReturnType<typeof locationApiModule.locatePlace>
  | { data: MapPoint & { zoom: number }; type: 'center' };
const locationApi = {
  ...jest.mocked(locationApiModule),
  locatePlace: jest.mocked(
    locationApiModule.locatePlace,
  ) as jest.MockedFunction<
    (
      feature: Parameters<typeof locationApiModule.locatePlace>[0],
    ) => SearchPageLocation
  >,
};
const tribesApi = jest.mocked(tribesApiModule);
const offersApi = jest.mocked(offersApiModule);

const sampleTribe = (id: string, slug: string): TribeSummary => ({
  _id: id,
  slug,
  label: 'Sample Circle',
  count: 1,
});

jest.mock('@/modules/core/client/services/client-runtime', () => ({
  trackEvent: (
    action: string,
    options?: { category?: string; label?: string; value?: string | number },
  ) => mockEventTrack(action, options),
  getCurrentRouteParams: () => mockGetRouteParams(),
}));

jest.mock('@/modules/search/client/api/location.api');
jest.mock('@/modules/tribes/client/api/tribes.api');
jest.mock('@/modules/offers/client/api/offers.api');

jest.mock('use-debounce', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    useDebouncedCallback: <Callback extends (...args: never[]) => unknown>(
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

jest.mock(
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

jest.mock(
  '@/modules/search/client/components/SearchCirclesToggle.component',
  () => ({
    __esModule: true,
    default: () => <div data-testid="circles-toggle" />,
  }),
);

jest.mock(
  '@/modules/search/client/components/SearchMyCirclesToggle.component',
  () => ({
    __esModule: true,
    default: () => <div data-testid="my-circles-toggle" />,
  }),
);

jest.mock(
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

jest.mock('@/modules/core/client/api/languages.api', () => ({
  useLanguagesQuery: () => ({ data: { en: 'English', fi: 'Finnish' } }),
}));

jest.mock('@/modules/search/client/components/SearchSidebar.component', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const ActualSearchSidebar = jest.requireActual<
    typeof import('@/modules/search/client/components/SearchSidebar.component')
  >('@/modules/search/client/components/SearchSidebar.component').default;

  return {
    __esModule: true,
    default: (props: React.ComponentProps<typeof ActualSearchSidebar>) => (
      <>
        <button onClick={() => props.onTabSelect('unexpected')} type="button">
          Select unexpected tab
        </button>
        <ActualSearchSidebar {...props} />
      </>
    ),
  };
});

jest.mock('@/modules/users/client/components/Avatar.component', () => ({
  __esModule: true,
  default: () => <span data-testid="avatar" />,
}));

jest.mock(
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

const mockOffer: SearchResultOffer & Offer & { _id: string } = {
  _id: '665100000000000000000001',
  type: 'host',
  status: 'yes',
  description: 'Welcome',
  location: [60.17, 24.94],
  user: {
    username: 'hoster',
    displayName: 'Host Person',
    birthdate: '1990-05-15T00:00:00.000Z',
    gender: 'female',
    languages: ['en'],
  },
};

jest.mock('@/modules/search/client/components/SearchMap.component', () => ({
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
  return render(<SearchPage user={user} />);
}

function openResultsWithVisibleOfferIds(offerIds: string[]) {
  fireEvent.click(screen.getByRole('tab', { name: /^results$/i }));
  act(() => searchMapProps.onVisibleOffersChange(offerIds));
}

describe('<SearchPage />', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    searchMapProps = {
      filters: '{}',
      isUserPublic: false,
      onOfferOpen: () => {},
      onCommunityNoteOpen: () => {},
      onVisibleOffersChange: () => {},
      onOfferClose: () => {},
    };
    window.localStorage.clear();
    mockGetRouteParams.mockReturnValue({});
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
    const pending = new Map<string, (offer: Offer) => void>();
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
    const pending: Array<(offer: Offer) => void> = [];
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
      pending.forEach(resolve => resolve(null as never));
      await Promise.resolve();
    });
    expect(offersApi.getOffer).toHaveBeenCalledTimes(8);
  });

  it('does not commit loaded offers after the search page unmounts', async () => {
    let resolveOffer!: (offer: Offer) => void;
    offersApi.getOffer.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveOffer = resolve;
        }),
    );
    const { unmount } = renderSearchPage();
    openResultsWithVisibleOfferIds(['offer-after-unmount']);
    await waitFor(() => expect(offersApi.getOffer).toHaveBeenCalledTimes(1));

    unmount();
    await act(async () => {
      resolveOffer({ ...mockOffer, _id: 'offer-after-unmount' });
      await Promise.resolve();
    });
    expect(offersApi.getOffer).toHaveBeenCalledTimes(1);
  });

  it('skips visible offers when the offer endpoint returns no result', async () => {
    // The endpoint can return no offer for a stale visible result.
    offersApi.getOffer.mockResolvedValue(null as never);
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

  it('ignores unknown sidebar tab keys', () => {
    renderSearchPage();

    fireEvent.click(
      screen.getByRole('button', { name: 'Select unexpected tab' }),
    );

    expect(screen.getByTestId('search-map')).toBeInTheDocument();
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
    mockGetRouteParams.mockReturnValue({ tribe: 'cyclists' });
    tribesApi.get.mockResolvedValue(sampleTribe('tribe-cyclists', 'cyclists'));

    renderSearchPage();

    await waitFor(() =>
      expect(searchMapProps.filters).toContain('tribe-cyclists'),
    );
    expect(tribesApi.get).toHaveBeenCalledWith('cyclists');
  });

  it('initialises the map location from a location query param', async () => {
    mockGetRouteParams.mockReturnValue({ location: 'Helsinki_Finland' });
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

  it('loads an offer from the route params and tracks preview analytics', async () => {
    const offerId = '665100000000000000000001';
    mockGetRouteParams.mockReturnValue({ offer: offerId });
    offersApi.getOffer.mockResolvedValue(mockOffer);

    renderSearchPage();

    await waitFor(() => {
      expect(offersApi.getOffer).toHaveBeenCalledWith(offerId);
    });

    expect(
      await screen.findByRole('link', { name: /host person/i }),
    ).toBeInTheDocument();
    expect(mockEventTrack).toHaveBeenCalledWith('offer.preview', {
      category: 'search.map',
      label: 'Preview offer',
    });
  });

  it('tracks missing offers loaded from the route params', async () => {
    mockGetRouteParams.mockReturnValue({
      offer: '665100000000000000000099',
    });
    offersApi.getOffer.mockRejectedValue(new Error('not found'));

    renderSearchPage();

    await waitFor(() => {
      expect(mockEventTrack).toHaveBeenCalledWith('offer-not-found', {
        category: 'search.map',
        label: 'Offer not found',
      });
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
    mockGetRouteParams.mockReturnValue({ location: 'Helsinki_Finland' });
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

  it('updates sidebar filters from the filters panel', () => {
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
    mockGetRouteParams.mockImplementation(() => {
      const params: RouteParams = {};
      new URLSearchParams(window.location.search).forEach((value, key) => {
        params[key] = value;
      });
      return params;
    });
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
    mockGetRouteParams.mockReturnValue({ tribe: 'cyclists' });
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
    mockGetRouteParams.mockReturnValue({ location: 'Helsinki_Finland' });
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
    mockGetRouteParams.mockReturnValue({ location: 'Helsinki_Finland' });
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
    let resolveOffer!: (offer: Offer) => void;
    const offerId = '665100000000000000000001';
    mockGetRouteParams.mockReturnValue({ offer: offerId });
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
    mockGetRouteParams.mockReturnValue({ offer: 'invalid' });
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
