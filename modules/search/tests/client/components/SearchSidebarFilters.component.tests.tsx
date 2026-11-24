import React from 'react';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react';

import { fakeAnalytics } from '@/testutils/client/analytics.testutil';
import '@/config/client/i18n';
import SearchSidebarFilters from '@/modules/search/client/components/SearchSidebarFilters.component';
import type SearchTypesToggle from '@/modules/search/client/components/SearchTypesToggle.component';
import type SearchCirclesToggle from '@/modules/search/client/components/SearchCirclesToggle.component';
import type SearchMyCirclesToggle from '@/modules/search/client/components/SearchMyCirclesToggle.component';
import type SearchFilterLanguage from '@/modules/search/client/components/SearchFilterLanguage.component';

type SidebarProps = React.ComponentProps<typeof SearchSidebarFilters>;

vi.mock(
  '@/modules/search/client/components/SearchTypesToggle.component',
  () => ({
    __esModule: true,
    default: ({ onChange }: React.ComponentProps<typeof SearchTypesToggle>) => (
      <>
        <button onClick={() => onChange(['host'])} type="button">
          Change to hosts
        </button>
        <button onClick={() => onChange(['meet'])} type="button">
          Change types
        </button>
      </>
    ),
  }),
);

vi.mock(
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

vi.mock(
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

vi.mock(
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
  onCloseSidebar: vi.fn(),
  onCommunityNotesToggle: vi.fn(),
  onFiltersChange: vi.fn(),
  onlineInPast6Months: true,
  onOnlineInPast6MonthsChange: vi.fn(),
};

describe('<SearchSidebarFilters />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it('describes the displayed volunteering offers and note locations', () => {
    render(
      <SearchSidebarFilters
        {...defaultProps}
        filters={{ ...defaultProps.filters, volunteering: true }}
        visibleMapCounts={{ host: 3, meet: 0, communityNotes: 2 }}
      />,
    );

    expect(
      screen.getByRole('checkbox', { name: 'Offers volunteering' }),
    ).toHaveAccessibleDescription('Map results 3');
    expect(
      screen.getByRole('checkbox', { name: /community notes/i }),
    ).toHaveAccessibleDescription('Map results 2');
  });

  it('forwards filter changes from child controls', () => {
    const onFiltersChange =
      vi.fn<
        (
          ...args: Parameters<SidebarProps['onFiltersChange']>
        ) => ReturnType<SidebarProps['onFiltersChange']>
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

    expect(onFiltersChange).toHaveBeenCalledWith({
      types: ['meet'],
      volunteering: false,
    });
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

  it('toggles confirmed contacts and temporarily hides community notes', () => {
    const { rerender } = render(<SearchSidebarFilters {...defaultProps} />);
    const connectionsOnly = screen.getByRole('checkbox', {
      name: 'My connections only',
    });
    expect(connectionsOnly).not.toBeChecked();
    fireEvent.click(connectionsOnly);
    expect(defaultProps.onFiltersChange).toHaveBeenCalledWith({
      connectionsOnly: true,
    });

    rerender(
      <SearchSidebarFilters
        {...defaultProps}
        filters={{ ...defaultProps.filters, connectionsOnly: true }}
      />,
    );
    expect(connectionsOnly).toBeChecked();
    const notes = screen.getByRole('checkbox', { name: /community notes/i });
    expect(notes).not.toBeChecked();
    expect(notes).toBeDisabled();
    fireEvent.click(connectionsOnly);
    expect(defaultProps.onFiltersChange).toHaveBeenLastCalledWith({
      connectionsOnly: false,
    });
  });

  it('enables volunteering with hosts included and can clear it without changing types', () => {
    const { rerender } = render(
      <SearchSidebarFilters
        {...defaultProps}
        filters={{ ...defaultProps.filters, types: ['meet'] }}
      />,
    );
    const toggle = screen.getByRole('checkbox', {
      name: 'Offers volunteering',
    });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(defaultProps.onFiltersChange).toHaveBeenLastCalledWith({
      volunteering: true,
      types: ['host', 'meet'],
    });
    expect(analytics.track).toHaveBeenLastCalledWith('search_filter_changed', {
      filter: 'volunteering',
    });
    rerender(
      <SearchSidebarFilters
        {...defaultProps}
        filters={{ ...defaultProps.filters, volunteering: true }}
      />,
    );
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(defaultProps.onFiltersChange).toHaveBeenLastCalledWith({
      volunteering: false,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change to hosts' }));
    expect(defaultProps.onFiltersChange).toHaveBeenLastCalledWith({
      types: ['host'],
    });
  });

  it('clears selected circles and toggles sidebar switches', () => {
    const onFiltersChange =
      vi.fn<
        (
          ...args: Parameters<SidebarProps['onFiltersChange']>
        ) => ReturnType<SidebarProps['onFiltersChange']>
      >();
    const onCommunityNotesToggle =
      vi.fn<
        (
          ...args: Parameters<SidebarProps['onCommunityNotesToggle']>
        ) => ReturnType<SidebarProps['onCommunityNotesToggle']>
      >();
    const onOnlineInPast6MonthsChange =
      vi.fn<
        (
          ...args: Parameters<SidebarProps['onOnlineInPast6MonthsChange']>
        ) => ReturnType<SidebarProps['onOnlineInPast6MonthsChange']>
      >();
    const onCloseSidebar =
      vi.fn<
        (
          ...args: Parameters<SidebarProps['onCloseSidebar']>
        ) => ReturnType<SidebarProps['onCloseSidebar']>
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
