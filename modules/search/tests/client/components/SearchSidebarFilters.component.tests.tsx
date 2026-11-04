import React from 'react';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { fakeAnalytics } from '@/testutils/client/analytics.testutil';
import '@/config/client/i18n';
import SearchSidebarFilters from '@/modules/search/client/components/SearchSidebarFilters.component';
import type SearchTypesToggle from '@/modules/search/client/components/SearchTypesToggle.component';
import type SearchCirclesToggle from '@/modules/search/client/components/SearchCirclesToggle.component';
import type SearchMyCirclesToggle from '@/modules/search/client/components/SearchMyCirclesToggle.component';
import type SearchFilterLanguage from '@/modules/search/client/components/SearchFilterLanguage.component';

type SidebarProps = React.ComponentProps<typeof SearchSidebarFilters>;

jest.mock(
  '@/modules/search/client/components/SearchTypesToggle.component',
  () => ({
    __esModule: true,
    default: ({ onChange }: React.ComponentProps<typeof SearchTypesToggle>) => (
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
    default: ({
      onChange,
    }: React.ComponentProps<typeof SearchCirclesToggle>) => (
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
    default: ({
      onChange,
    }: React.ComponentProps<typeof SearchMyCirclesToggle>) => (
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
    default: ({
      onChangeLanguages,
    }: React.ComponentProps<typeof SearchFilterLanguage>) => (
      <button onClick={() => onChangeLanguages(['en'])} type="button">
        Change languages
      </button>
    ),
  }),
);

const analytics = fakeAnalytics();
const render = (...[ui, options]: Parameters<typeof rtlRender>) =>
  rtlRender(ui, { wrapper: analytics.wrapper, ...options });

const defaultProps: SidebarProps = {
  communityNotesEnabled: true,
  filters: {
    tribes: ['cyclists'],
    types: ['host', 'meet'],
    languages: [],
    seen: { months: 6 },
    communityNotes: true,
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
    const onFiltersChange = jest.fn<
      ReturnType<SidebarProps['onFiltersChange']>,
      Parameters<SidebarProps['onFiltersChange']>
    >();

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
    expect(analytics.track.mock.calls).toEqual([
      ['search_filter_changed', { filter: 'types' }],
      ['search_filter_changed', { filter: 'circles' }],
      ['search_filter_changed', { filter: 'my_circles' }],
      ['search_filter_changed', { filter: 'languages' }],
    ]);
  });

  it('clears selected circles and toggles sidebar switches', () => {
    const onFiltersChange = jest.fn<
      ReturnType<SidebarProps['onFiltersChange']>,
      Parameters<SidebarProps['onFiltersChange']>
    >();
    const onCommunityNotesToggle = jest.fn<
      ReturnType<SidebarProps['onCommunityNotesToggle']>,
      Parameters<SidebarProps['onCommunityNotesToggle']>
    >();
    const onOnlineInPast6MonthsChange = jest.fn<
      ReturnType<SidebarProps['onOnlineInPast6MonthsChange']>,
      Parameters<SidebarProps['onOnlineInPast6MonthsChange']>
    >();
    const onCloseSidebar = jest.fn<
      ReturnType<SidebarProps['onCloseSidebar']>,
      Parameters<SidebarProps['onCloseSidebar']>
    >();

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
    expect(analytics.track.mock.calls).toEqual([
      ['search_filter_changed', { filter: 'community_notes' }],
      ['search_filter_changed', { filter: 'online_recently' }],
    ]);
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
