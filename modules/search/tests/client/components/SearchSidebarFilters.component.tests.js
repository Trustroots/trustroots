import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import SearchSidebarFilters from '@/modules/search/client/components/SearchSidebarFilters.component';

jest.mock(
  '@/modules/search/client/components/SearchTypesToggle.component',
  () => ({
    __esModule: true,
    default: ({ onChange }) => (
      <button onClick={() => onChange(['meet'])} type="button">
        Change types
      </button>
    ),
  }),
);

jest.mock(
  '@/modules/search/client/components/SearchCirclesToggle.component',
  () => ({
    __esModule: true,
    default: ({ onChange }) => (
      <button onClick={() => onChange(['cyclists'])} type="button">
        Change circles
      </button>
    ),
  }),
);

jest.mock(
  '@/modules/search/client/components/SearchMyCirclesToggle.component',
  () => ({
    __esModule: true,
    default: ({ onChange }) => (
      <button onClick={() => onChange(['hikers'])} type="button">
        Change my circles
      </button>
    ),
  }),
);

jest.mock(
  '@/modules/search/client/components/SearchFilterLanguage.component',
  () => ({
    __esModule: true,
    default: ({ onChangeLanguages }) => (
      <button onClick={() => onChangeLanguages(['en'])} type="button">
        Change languages
      </button>
    ),
  }),
);

const defaultProps = {
  communityNotesEnabled: true,
  filters: {
    tribes: ['cyclists'],
    types: ['host', 'meet'],
    languages: [],
    seen: { months: 6 },
  },
  onCloseSidebar: jest.fn(),
  onCommunityNotesToggle: jest.fn(),
  onFiltersChange: jest.fn(),
  onlineInPast6Months: true,
  onOnlineInPast6MonthsChange: jest.fn(),
};

describe('<SearchSidebarFilters />', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders map content and circle filter controls', () => {
    render(<SearchSidebarFilters {...defaultProps} />);

    expect(
      screen.getByRole('heading', { name: 'Map content' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Circles' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /community notes/i }),
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: /online in the past 6 months/i }),
    ).toBeChecked();
    screen.getAllByRole('checkbox').forEach(toggle => {
      expect(toggle.nextElementSibling).toHaveClass('toggle');
    });
  });

  it('forwards filter changes from child controls', () => {
    const onFiltersChange = jest.fn();

    render(
      <SearchSidebarFilters
        {...defaultProps}
        onFiltersChange={onFiltersChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /change types/i }));
    fireEvent.click(screen.getByRole('button', { name: /change circles/i }));
    fireEvent.click(screen.getByRole('button', { name: /change my circles/i }));
    fireEvent.click(screen.getByRole('button', { name: /change languages/i }));

    expect(onFiltersChange).toHaveBeenCalledWith({ types: ['meet'] });
    expect(onFiltersChange).toHaveBeenCalledWith({ tribes: ['cyclists'] });
    expect(onFiltersChange).toHaveBeenCalledWith({ tribes: ['hikers'] });
    expect(onFiltersChange).toHaveBeenCalledWith({ languages: ['en'] });
  });

  it('clears selected circles and toggles sidebar switches', () => {
    const onFiltersChange = jest.fn();
    const onCommunityNotesToggle = jest.fn();
    const onOnlineInPast6MonthsChange = jest.fn();
    const onCloseSidebar = jest.fn();

    render(
      <SearchSidebarFilters
        {...defaultProps}
        onCloseSidebar={onCloseSidebar}
        onCommunityNotesToggle={onCommunityNotesToggle}
        onFiltersChange={onFiltersChange}
        onOnlineInPast6MonthsChange={onOnlineInPast6MonthsChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /clear circles/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /community notes/i }));
    fireEvent.click(
      screen.getByRole('checkbox', { name: /online in the past 6 months/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /back to map/i }));

    expect(onFiltersChange).toHaveBeenCalledWith({ tribes: [] });
    expect(onCommunityNotesToggle).toHaveBeenCalled();
    expect(onOnlineInPast6MonthsChange).toHaveBeenCalled();
    expect(onCloseSidebar).toHaveBeenCalled();
  });

  it('disables clear circles when no circles are selected', () => {
    render(
      <SearchSidebarFilters
        {...defaultProps}
        filters={{ ...defaultProps.filters, tribes: [] }}
      />,
    );

    expect(
      screen.getByRole('button', { name: /clear circles/i }),
    ).toBeDisabled();
  });
});
