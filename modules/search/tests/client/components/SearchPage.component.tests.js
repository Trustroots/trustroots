import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import SearchPage from '@/modules/search/client/components/SearchPage.component';
import * as locationApi from '@/modules/search/client/api/location.api';
import * as tribesApi from '@/modules/tribes/client/api/tribes.api';
import * as offersApi from '@/modules/offers/client/api/offers.api';

const mockEventTrack = jest.fn();
const mockGetRouteParams = jest.fn(() => ({}));

jest.mock('@/modules/core/client/services/client-runtime', () => ({
  trackEvent: (...args) => mockEventTrack(...args),
  getCurrentRouteParams: () => mockGetRouteParams(),
}));

jest.mock('@/modules/search/client/api/location.api');
jest.mock('@/modules/tribes/client/api/tribes.api');
jest.mock('@/modules/offers/client/api/offers.api');

jest.mock('use-debounce', () => {
  const React = require('react');

  return {
    useDebouncedCallback: callback => {
      const callbackRef = React.useRef(callback);
      callbackRef.current = callback;

      const stable = React.useCallback(
        (...args) => callbackRef.current(...args),
        [],
      );

      return [stable];
    },
  };
});

jest.mock(
  '@/modules/search/client/components/SearchTypesToggle.component',
  () => ({
    __esModule: true,
    default: ({ onChange, types }) => (
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
    default: ({ onChangeLanguages }) => (
      <button onClick={() => onChangeLanguages(['fi'])} type="button">
        Language filter
      </button>
    ),
  }),
);

jest.mock('@/modules/core/client/api/languages.api', () => ({
  useLanguagesQuery: () => ({ data: { en: 'English', fi: 'Finnish' } }),
}));

jest.mock('@/modules/users/client/components/Avatar.component', () => ({
  __esModule: true,
  default: () => <span data-testid="avatar" />,
}));

jest.mock(
  '@/modules/search/client/components/CommunityNotesSidebar.component',
  () => ({
    __esModule: true,
    default: ({ plusCode }) => (
      <div data-testid="community-notes-sidebar">{plusCode}</div>
    ),
  }),
);

let searchMapProps;

const mockOffer = {
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
  default: props => {
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
        <button onClick={() => props.onOfferClose()} type="button">
          Close offer
        </button>
      </div>
    );
  },
}));

function renderSearchPage(
  user = { _id: 'user-1', public: true, username: 'alice' },
) {
  return render(<SearchPage user={user} />);
}

describe('<SearchPage />', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    searchMapProps = undefined;
    window.localStorage.clear();
    mockGetRouteParams.mockReturnValue({});
    locationApi.fetchLocationSuggestions.mockResolvedValue([]);
    locationApi.locatePlace.mockReturnValue(null);
    tribesApi.get.mockResolvedValue({});
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

  it('shows the activation message for non-public members', () => {
    renderSearchPage({ _id: 'user-1', public: false, username: 'alice' });

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
    mockGetRouteParams.mockReturnValue({ tribe: 'cyclists' });
    tribesApi.get.mockResolvedValue({ _id: 'tribe-cyclists' });

    renderSearchPage();

    await waitFor(() => {
      expect(tribesApi.get).toHaveBeenCalledWith('cyclists');
    });

    expect(searchMapProps.filters).toContain('tribe-cyclists');
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

    await waitFor(() => {
      expect(locationApi.fetchLocationSuggestions).toHaveBeenCalledWith(
        'Helsinki Finland',
      );
    });

    expect(searchMapProps.location).toEqual({
      lat: 60.17,
      lng: 24.94,
      zoom: 10,
    });
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
    let resolveTribe;
    mockGetRouteParams.mockReturnValue({ tribe: 'cyclists' });
    tribesApi.get.mockReturnValue(
      new Promise(resolve => {
        resolveTribe = resolve;
      }),
    );

    const { unmount } = renderSearchPage();
    unmount();
    resolveTribe({ _id: 'tribe-cyclists' });

    await new Promise(resolve => setTimeout(resolve, 0));
  });

  it('ignores location suggestions that resolve after the page unmounts', async () => {
    let resolveSuggestions;
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
    let resolveOffer;
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

    let rejectOffer;
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

  it('passes public visibility through to the map', () => {
    renderSearchPage({ _id: 'user-1', public: true, username: 'alice' });

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

  it('closes the sidebar from the filters back button on small screens', () => {
    renderSearchPage();

    const sidebar = document.querySelector('.search-sidebar-container');
    const backButtons = within(sidebar).getAllByRole('button', {
      name: /back to map/i,
    });

    fireEvent.click(backButtons[0]);

    expect(document.querySelector('.search.is-sidebar-open')).toBeFalsy();
  });
});
