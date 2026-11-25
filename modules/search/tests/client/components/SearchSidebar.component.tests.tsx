import React from 'react';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react';
import { fakeAnalytics } from '@/testutils/client/analytics.testutil';

import '@/config/client/i18n';
import SearchSidebar from '@/modules/search/client/components/SearchSidebar.component';

const analyticsWrapper = fakeAnalytics().wrapper;
const render = (...[ui, options]: Parameters<typeof rtlRender>) =>
  rtlRender(ui, { wrapper: analyticsWrapper, ...options });

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

vi.mock('@/modules/search/client/api/location.api', () => ({
  fetchLocationSuggestions: vi.fn().mockResolvedValue([]),
  locatePlace: vi.fn(),
}));

vi.mock(
  '@/modules/search/client/components/SearchTypesToggle.component',
  () => ({
    __esModule: true,
    default: () => <div data-testid="types-toggle" />,
  }),
);

vi.mock(
  '@/modules/search/client/components/SearchCirclesToggle.component',
  () => ({
    __esModule: true,
    default: () => <div data-testid="circles-toggle" />,
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
    default: () => <div data-testid="language-filter" />,
  }),
);

vi.mock('@/modules/core/client/api/languages.api', () => ({
  useLanguagesQuery: () => ({ data: {} }),
}));

vi.mock('@/modules/users/client/components/Avatar.component', () => ({
  __esModule: true,
  default: () => <span data-testid="avatar" />,
}));

vi.mock(
  '@/modules/search/client/components/CommunityNotesSidebar.component',
  () => ({
    __esModule: true,
    default: () => <div data-testid="community-notes-sidebar" />,
  }),
);

const defaultProps: React.ComponentProps<typeof SearchSidebar> = {
  activeTab: 'filters',
  communityNote: null,
  communityNotesEnabled: true,
  filters: {
    tribes: [],
    types: ['host', 'meet'],
    languages: [],
    seen: { months: 6 },
    communityNotes: true,
  },
  isLoadingOffer: false,
  offer: null,
  offers: [],
  communityNoteThreads: [],
  onOfferSelect: vi.fn(),
  onCommunityNoteSelect: vi.fn(),
  onBackToOffers: vi.fn(),
  onCloseSidebar: vi.fn(),
  onCommunityNotesToggle: vi.fn(),
  onFiltersChange: vi.fn(),
  onPlaceSearch: vi.fn(),
  onTabSelect: vi.fn(),
  onlineInPast6Months: true,
  onOnlineInPast6MonthsChange: vi.fn(),
  searchQuery: '',
  setSearchQuery: vi.fn(),
};

describe('<SearchSidebar />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders place search, filters, and results tabs', () => {
    render(<SearchSidebar {...defaultProps} />);

    expect(screen.getByLabelText('Search places')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^filters$/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: /^results$/i })).toBeInTheDocument();
    expect(screen.getByTestId('types-toggle')).toBeInTheDocument();
  });

  it('switches tabs through onTabSelect', () => {
    const onTabSelect = vi.fn();

    render(<SearchSidebar {...defaultProps} onTabSelect={onTabSelect} />);

    fireEvent.click(screen.getByRole('tab', { name: /^results$/i }));

    expect(onTabSelect).toHaveBeenCalledWith('results');
  });

  it('shows offer results in the results tab', () => {
    render(
      <SearchSidebar
        {...defaultProps}
        activeTab="results"
        offer={{
          _id: 'offer-1',
          type: 'host',
          status: 'yes',
          description: 'Welcome travellers',
          user: {
            username: 'river',
            displayName: 'River Host',
          },
        }}
      />,
    );

    expect(
      screen.getByRole('link', { name: /river host/i }),
    ).toBeInTheDocument();
  });
});
