import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import SearchSidebar from '@/modules/search/client/components/SearchSidebar.component';

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

jest.mock('@/modules/search/client/api/location.api', () => ({
  fetchLocationSuggestions: jest.fn().mockResolvedValue([]),
  locatePlace: jest.fn(),
}));

jest.mock(
  '@/modules/search/client/components/SearchTypesToggle.component',
  () => ({
    __esModule: true,
    default: () => <div data-testid="types-toggle" />,
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
    default: () => <div data-testid="language-filter" />,
  }),
);

jest.mock('@/modules/core/client/api/languages.api', () => ({
  useLanguagesQuery: () => ({ data: {} }),
}));

jest.mock('@/modules/users/client/components/Avatar.component', () => ({
  __esModule: true,
  default: () => <span data-testid="avatar" />,
}));

jest.mock(
  '@/modules/search/client/components/CommunityNotesSidebar.component',
  () => ({
    __esModule: true,
    default: () => <div data-testid="community-notes-sidebar" />,
  }),
);

const defaultProps = {
  activeTab: 'filters',
  communityNote: null,
  communityNotesEnabled: true,
  filters: {
    tribes: [],
    types: ['host', 'meet'],
    languages: [],
    seen: { months: 6 },
  },
  isLoadingOffer: false,
  offer: null,
  onCloseSidebar: jest.fn(),
  onCommunityNotesToggle: jest.fn(),
  onFiltersChange: jest.fn(),
  onPlaceSearch: jest.fn(),
  onTabSelect: jest.fn(),
  onlineInPast6Months: true,
  onOnlineInPast6MonthsChange: jest.fn(),
  searchQuery: '',
  setSearchQuery: jest.fn(),
};

describe('<SearchSidebar />', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    const onTabSelect = jest.fn();

    render(<SearchSidebar {...defaultProps} onTabSelect={onTabSelect} />);

    fireEvent.click(screen.getByRole('tab', { name: /^results$/i }));

    expect(onTabSelect).toHaveBeenCalledWith('results', expect.anything());
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
