import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import AdminAcquisitionStories from '@/modules/admin/client/components/AdminAcquisitionStories.component';
import * as acquisitionStoriesApi from '@/modules/admin/client/api/acquisition-stories.api';
import { useLanguagesQuery } from '@/modules/core/client/api/languages.api';

jest.mock('@/modules/core/client/services/client-runtime', () => ({
  getCurrentUser: () => global.window.user,
}));

jest.mock('@/modules/admin/client/api/acquisition-stories.api');
jest.mock('@/modules/core/client/api/languages.api');
const mockedAcquisitionStoriesApi = jest.mocked(acquisitionStoriesApi);
const mockedUseLanguagesQuery = jest.mocked(useLanguagesQuery);
jest.mock('@/modules/core/client/components/LoadingIndicator', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return function MockLoadingIndicator() {
    return <div role="alertdialog">Wait a moment</div>;
  };
});

type ViewerFixture = NonNullable<Window['user']>;
type AcquisitionStoryFixture = {
  _id: string;
  username: string;
  acquisitionStory?: string;
  circleCount?: number;
  created?: string;
  displayName?: string;
  hostingLocation?: number[];
  locationFrom?: string;
  locationLiving?: string;
  public?: boolean;
  restrictedMatches?: Array<{
    _id: string;
    username: string;
    displayName?: string;
    matchReasons: string[];
    roles?: string[];
  }>;
  languages?: string[];
  welcomer?: {
    _id: string;
    username: string;
    displayName?: string;
    created?: string;
  } | null;
};

type LanguagesQueryResult = ReturnType<typeof useLanguagesQuery>;

// The page only consumes these fields from the React Query result, so the
// remaining React Query state is intentionally omitted in this mock fixture.
function languageQueryFixture(
  data: Record<string, string>,
): LanguagesQueryResult {
  return { data, isLoading: false } as LanguagesQueryResult;
}

function storyFixture(fixture: AcquisitionStoryFixture) {
  return fixture;
}

beforeEach(() => {
  window.user = { roles: ['admin'] };
  mockedUseLanguagesQuery.mockReturnValue(
    languageQueryFixture({
      eng: 'English',
      fre: 'French',
      spa: 'Spanish',
      ger: 'German',
    }),
  );
});

afterEach(() => {
  delete window.user;
  jest.clearAllMocks();
});

describe('<AdminAcquisitionStories />', () => {
  it.each(['admin', 'welcome-team', 'support-team'] as const)(
    'filters unassigned members and preserves sorting for %s',
    async role => {
      window.user = { roles: [role] };
      mockedAcquisitionStoriesApi.getAcquisitionStories.mockResolvedValueOnce([
        storyFixture({ _id: 'river-id', username: 'river', welcomer: null }),
        storyFixture({
          _id: 'forest-id',
          username: 'forest',
          welcomer: {
            _id: 'greeter-id',
            username: 'greeter',
            created: '2026-01-01T00:00:00.000Z',
          },
        }),
        storyFixture({ _id: 'brook-id', username: 'brook' }),
      ]);

      render(<AdminAcquisitionStories />);
      await screen.findByRole('table');
      const checkbox = screen.getByRole('checkbox', {
        name: 'Unassigned only',
      });
      const memberOrder = () =>
        Array.from(document.querySelectorAll('tbody tr')).map(
          row => row.querySelector('td:nth-child(2)')?.textContent || '',
        );

      expect(checkbox).not.toBeChecked();
      fireEvent.click(screen.getByRole('button', { name: 'Member' }));
      expect(memberOrder()).toEqual(['brook', 'forest', 'river']);
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
      expect(memberOrder()).toEqual(['brook', 'river']);
      expect(screen.getAllByText('Unassigned', { exact: true })).toHaveLength(
        2,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Member ▲' }));
      expect(memberOrder()).toEqual(['river', 'brook']);
      fireEvent.click(checkbox);
      expect(memberOrder()).toEqual(['river', 'forest', 'brook']);
      expect(
        mockedAcquisitionStoriesApi.getAcquisitionStories,
      ).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps the filter available when all members are assigned', async () => {
    mockedAcquisitionStoriesApi.getAcquisitionStories.mockResolvedValueOnce([
      {
        _id: 'forest-id',
        username: 'forest',
        welcomer: {
          _id: 'greeter-id',
          username: 'greeter',
          created: '2026-01-01T00:00:00.000Z',
        },
      },
    ]);

    render(<AdminAcquisitionStories />);
    await screen.findByRole('table');
    const checkbox = screen.getByRole('checkbox', { name: 'Unassigned only' });
    fireEvent.click(checkbox);
    expect(
      screen.getByText('No unassigned acquisition stories found.'),
    ).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(checkbox).toBeVisible();
    fireEvent.click(checkbox);
    expect(
      screen.getByRole('link', { name: 'forest', exact: true }),
    ).toBeVisible();
  });

  it('filters by profile visibility together with assignment without refetching', async () => {
    mockedAcquisitionStoriesApi.getAcquisitionStories.mockResolvedValueOnce([
      { _id: 'visible-id', username: 'visible-member', public: true },
      {
        _id: 'hidden-assigned-id',
        username: 'hidden-assigned',
        public: false,
        welcomer: {
          _id: 'greeter-id',
          username: 'fictional-greeter',
          created: '2026-01-01T00:00:00.000Z',
        },
      },
      { _id: 'hidden-id', username: 'hidden-member', public: false },
    ]);

    render(<AdminAcquisitionStories />);
    await screen.findByRole('table');

    const visibility = screen.getByRole('combobox', {
      name: 'Profile visibility',
    });
    const memberOrder = () =>
      Array.from(document.querySelectorAll('tbody tr')).map(
        row => row.querySelector('td:nth-child(2)')?.textContent || '',
      );

    expect(visibility).toHaveValue('all');
    expect(memberOrder()).toEqual([
      'visible-member',
      'hidden-assigned',
      'hidden-member',
    ]);
    expect(
      screen.getByText(
        'Hidden profiles have not activated their signup through email confirmation.',
      ),
    ).toBeVisible();

    fireEvent.change(visibility, { target: { value: 'visible' } });
    expect(memberOrder()).toEqual(['visible-member']);
    fireEvent.change(visibility, { target: { value: 'hidden' } });
    expect(memberOrder()).toEqual(['hidden-assigned', 'hidden-member']);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Unassigned only' }));
    expect(memberOrder()).toEqual(['hidden-member']);
    expect(
      mockedAcquisitionStoriesApi.getAcquisitionStories,
    ).toHaveBeenCalledTimes(1);
  });

  it('keeps visibility controls available when a visibility filter has no matches', async () => {
    mockedAcquisitionStoriesApi.getAcquisitionStories.mockResolvedValueOnce([
      { _id: 'visible-id', username: 'visible-member', public: true },
    ]);

    render(<AdminAcquisitionStories />);
    await screen.findByRole('table');
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Profile visibility' }),
      {
        target: { value: 'hidden' },
      },
    );

    expect(
      screen.getByText('No acquisition stories found.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Profile visibility' }),
    ).toBeVisible();
    expect(
      screen.getByRole('checkbox', { name: 'Unassigned only' }),
    ).toBeVisible();
  });

  it.each([
    { roles: ['welcome-team'] },
    {},
    null,
  ] as Array<ViewerFixture | null>)(
    'uses public member links for a non-administrator %j',
    async user => {
      window.user = user;
      mockedAcquisitionStoriesApi.getAcquisitionStories.mockResolvedValueOnce([
        {
          _id: 'member-id',
          username: 'river',
          acquisitionStory: 'Friends',
          restrictedMatches: [
            {
              _id: 'match-id',
              username: 'forest',
              matchReasons: ['Username identifier'],
            },
          ],
        },
      ]);
      render(<AdminAcquisitionStories />);
      expect(
        await screen.findByRole('link', { name: 'river', exact: true }),
      ).toHaveAttribute('href', '/profile/river');
      expect(
        screen.getByRole('link', { name: 'forest', exact: true }),
      ).toHaveAttribute('href', '/profile/forest');
    },
  );

  it('loads and renders acquisition stories with member links', async () => {
    mockedAcquisitionStoriesApi.getAcquisitionStories.mockResolvedValueOnce([
      {
        _id: '111111111111111111111111',
        acquisitionStory: 'I met people at a hitchhiking festival.',
        circleCount: 3,
        created: '2026-04-05T06:07:08.000Z',
        displayName: 'Alice Example',
        hostingLocation: [52.37, 4.9],
        locationFrom: 'Fictional origin',
        locationLiving: 'Fictional home',
        public: true,
        restrictedMatches: [
          {
            _id: '222222222222222222222222',
            displayName: 'Restricted Example',
            matchReasons: ['Username identifier'],
            roles: ['user', 'shadowban'],
            username: 'restricted',
          },
        ],
        username: 'alice',
      },
    ]);

    render(<AdminAcquisitionStories />);

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Wait a moment');
    expect(
      await screen.findByText('I met people at a hitchhiking festival.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'alice (Alice Example)' }),
    ).toHaveAttribute('href', '/admin/user/alice');
    expect(
      screen.getByRole('link', {
        name: 'Open public profile for Alice Example',
      }),
    ).toHaveAttribute('href', '/profile/alice');
    const profileImage = screen
      .getByRole('link', {
        name: 'Open public profile for Alice Example',
      })
      .querySelector('img');
    expect(profileImage).toHaveAttribute('loading', 'lazy');
    expect(profileImage).toHaveAttribute(
      'src',
      '/api/users/111111111111111111111111/avatar?size=32',
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Living: Fictional home')).toBeInTheDocument();
    expect(screen.getByText('From: Fictional origin')).toBeInTheDocument();
    expect(screen.getByText('Hosting: 52.370, 4.900')).toBeInTheDocument();
    expect(screen.getByRole('table').querySelector('tbody')).toHaveTextContent(
      'Visible',
    );
    expect(
      screen.getByRole('link', {
        name: 'restricted (Restricted Example)',
      }),
    ).toHaveAttribute('href', '/admin/user/restricted');
    expect(screen.getByText(/— Username identifier/)).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Analysis' }),
    ).not.toBeInTheDocument();
  });

  it('shows an empty state when no acquisition stories are returned', async () => {
    mockedAcquisitionStoriesApi.getAcquisitionStories.mockResolvedValueOnce(
      null,
    );

    render(<AdminAcquisitionStories />);

    expect(
      await screen.findByText('No acquisition stories found.'),
    ).toBeInTheDocument();
    expect(
      mockedAcquisitionStoriesApi.getAcquisitionStories,
    ).toHaveBeenCalledTimes(1);
  });

  it('renders stories with missing or invalid dates', async () => {
    mockedAcquisitionStoriesApi.getAcquisitionStories.mockResolvedValueOnce([
      {
        _id: '111111111111111111111111',
        acquisitionStory: 'No date story.',
        username: 'alice',
      },
      {
        _id: '222222222222222222222222',
        acquisitionStory: 'Invalid date story.',
        created: 'not-a-date',
        hostingLocation: [1],
        username: 'bob',
      },
    ]);

    render(<AdminAcquisitionStories />);

    expect(await screen.findByText('No date story.')).toBeInTheDocument();
    expect(screen.getByText('Invalid date story.')).toBeInTheDocument();
    expect(screen.getAllByText('', { selector: 'time' })).toHaveLength(2);
  });

  it('puts shared languages first and emphasises shared non-English languages', async () => {
    window.user = { roles: ['admin'], languages: ['fre', 'eng'] };
    mockedAcquisitionStoriesApi.getAcquisitionStories.mockResolvedValueOnce([
      {
        _id: '333333333333333333333333',
        username: 'casey',
        languages: ['spa', 'eng', 'ger', 'fre'],
      },
    ]);

    render(<AdminAcquisitionStories />);

    await screen.findByRole('table');
    const list = screen.getByRole('table').querySelector('tbody ul')!;
    expect(Array.from(list.children).map(item => item.textContent)).toEqual([
      'English',
      'French',
      'Spanish',
      'German',
    ]);
    expect(list.children[0].querySelector('strong')).toBeNull();
    expect(list.children[1].querySelector('strong')).toHaveTextContent(
      'French',
    );
    expect(list.children[2].querySelector('strong')).toBeNull();
    expect(list.children[3].querySelector('strong')).toBeNull();
  });

  it.each([
    ['viewer is absent', null],
    ['viewer has no language list', { roles: ['admin'] }],
    ['viewer shares no languages', { roles: ['admin'], languages: ['ger'] }],
  ] as Array<[string, ViewerFixture | null]>)(
    'renders the language column without emphasis when %s',
    async (_label, viewer) => {
      window.user = viewer;
      mockedAcquisitionStoriesApi.getAcquisitionStories.mockResolvedValueOnce([
        {
          _id: '333333333333333333333333',
          username: 'casey',
          languages: ['fre', 'eng'],
        },
      ]);

      render(<AdminAcquisitionStories />);

      await screen.findByRole('table');
      const list = screen.getByRole('table').querySelector('tbody ul')!;
      expect(Array.from(list.children).map(item => item.textContent)).toEqual([
        'French',
        'English',
      ]);
      expect(list.querySelector('strong')).toBeNull();
    },
  );

  it.each([[], undefined] as Array<string[] | undefined>)(
    'shows Not specified for recipient languages %j',
    async languages => {
      mockedAcquisitionStoriesApi.getAcquisitionStories.mockResolvedValueOnce([
        { _id: '333333333333333333333333', username: 'casey', languages },
      ]);

      render(<AdminAcquisitionStories />);

      expect(await screen.findByText('Not specified')).toBeInTheDocument();
    },
  );

  it('renders the welcomer with contact date and public links for non-admins', async () => {
    window.user = {};
    mockedAcquisitionStoriesApi.getAcquisitionStories.mockResolvedValueOnce([
      {
        _id: '333333333333333333333333',
        username: 'casey',
        welcomer: {
          _id: '444444444444444444444444',
          username: 'welcomer',
          displayName: 'Welcomer Example',
          created: '2026-03-04T05:06:07.000Z',
        },
      },
    ]);

    render(<AdminAcquisitionStories />);

    expect(
      await screen.findByRole('link', { name: 'welcomer (Welcomer Example)' }),
    ).toHaveAttribute('href', '/profile/welcomer');
    expect(screen.getByText('2026-03-04')).toHaveAttribute(
      'dateTime',
      '2026-03-04T05:06:07.000Z',
    );
    expect(screen.getByRole('link', { name: 'casey' })).toHaveAttribute(
      'href',
      '/profile/casey',
    );
  });

  it('uses admin links and marks contacted stories with a row class', async () => {
    mockedAcquisitionStoriesApi.getAcquisitionStories.mockResolvedValueOnce([
      {
        _id: '333333333333333333333333',
        username: 'contacted',
        welcomer: {
          _id: '444444444444444444444444',
          username: 'welcomer',
          created: '2026-03-04T05:06:07.000Z',
        },
      },
      { _id: '555555555555555555555555', username: 'unassigned' },
    ]);

    render(<AdminAcquisitionStories />);

    const welcomerLink = await screen.findByRole('link', { name: 'welcomer' });
    expect(welcomerLink).toHaveAttribute('href', '/admin/user/welcomer');
    const contactedRow = welcomerLink.closest('tr');
    expect(contactedRow).toHaveClass('admin-acquisition-stories-contacted');
    expect(screen.getByText('Unassigned').closest('tr')).not.toHaveClass(
      'admin-acquisition-stories-contacted',
    );
    expect(screen.getByRole('link', { name: 'contacted' })).toHaveAttribute(
      'href',
      '/admin/user/contacted',
    );
  });

  it('renders an empty acquisition story when the field is absent', async () => {
    mockedAcquisitionStoriesApi.getAcquisitionStories.mockResolvedValueOnce([
      {
        _id: '333333333333333333333333',
        username: 'casey',
      },
    ]);

    render(<AdminAcquisitionStories />);

    expect(
      await screen.findByRole('link', { name: 'casey' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('casey');
  });

  it('sorts stories by every table column', async () => {
    mockedAcquisitionStoriesApi.getAcquisitionStories.mockResolvedValueOnce([
      {
        _id: '111111111111111111111111',
        acquisitionStory: 'Zebra recommendation',
        circleCount: 2,
        created: '2026-01-01T00:00:00.000Z',
        displayName: 'Alice Example',
        public: true,
        username: 'alice',
      },
      {
        _id: '222222222222222222222222',
        circleCount: 0,
        created: '2026-02-01T00:00:00.000Z',
        displayName: 'Bob Example',
        public: false,
        username: 'bob',
      },
    ]);

    render(<AdminAcquisitionStories />);
    await screen.findByText('Zebra recommendation');

    const storyOrder = () =>
      Array.from(document.querySelectorAll('tbody tr')).map(row =>
        (row.textContent || '').includes('Zebra recommendation')
          ? 'alice'
          : 'bob',
      );

    expect(storyOrder()).toEqual(['bob', 'alice']);
    expect(screen.getByText('Date ▼').closest('th')).toHaveAttribute(
      'aria-sort',
      'descending',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Date ▼' }));
    expect(storyOrder()).toEqual(['alice', 'bob']);
    fireEvent.click(screen.getByRole('button', { name: 'Date ▲' }));
    expect(storyOrder()).toEqual(['bob', 'alice']);

    fireEvent.click(screen.getByRole('button', { name: 'Member' }));
    expect(storyOrder()).toEqual(['alice', 'bob']);

    fireEvent.click(screen.getByRole('button', { name: 'Circles' }));
    expect(storyOrder()).toEqual(['bob', 'alice']);
    fireEvent.click(screen.getByRole('button', { name: 'Circles ▲' }));
    expect(storyOrder()).toEqual(['alice', 'bob']);

    fireEvent.click(screen.getByRole('button', { name: 'Story' }));
    expect(storyOrder()).toEqual(['bob', 'alice']);

    fireEvent.click(screen.getByRole('button', { name: 'Profile visible' }));
    expect(storyOrder()).toEqual(['bob', 'alice']);
    fireEvent.click(screen.getByRole('button', { name: 'Profile visible ▲' }));
    expect(storyOrder()).toEqual(['alice', 'bob']);
  });

  it('sorts by welcomer assignment in both directions', async () => {
    mockedAcquisitionStoriesApi.getAcquisitionStories.mockResolvedValueOnce([
      {
        _id: '111111111111111111111111',
        username: 'contacted',
        welcomer: {
          _id: '333333333333333333333333',
          username: 'welcome-team',
          created: '2026-01-01T00:00:00.000Z',
        },
      },
      { _id: '222222222222222222222222', username: 'unassigned' },
    ]);

    render(<AdminAcquisitionStories />);
    await screen.findByText('Unassigned');

    const memberOrder = () =>
      Array.from(document.querySelectorAll('tbody tr')).map(row =>
        (row.textContent || '').includes('contacted')
          ? 'contacted'
          : 'unassigned',
      );

    fireEvent.click(screen.getByRole('button', { name: 'Greeter' }));
    expect(memberOrder()).toEqual(['unassigned', 'contacted']);
    fireEvent.click(screen.getByRole('button', { name: 'Greeter ▲' }));
    expect(memberOrder()).toEqual(['contacted', 'unassigned']);
  });

  it('explains its compact sortable and static column headings', async () => {
    mockedAcquisitionStoriesApi.getAcquisitionStories.mockResolvedValueOnce([
      {
        _id: '111111111111111111111111',
        acquisitionStory: 'A friend recommended it',
        public: false,
        username: 'alice',
      },
    ]);

    render(<AdminAcquisitionStories />);
    await screen.findByText('A friend recommended it');

    fireEvent.focus(screen.getByRole('button', { name: 'Date ▼' }));
    expect(await screen.findByText('Date the member signed up')).toBeVisible();

    fireEvent.mouseOver(
      screen.getByLabelText(
        'Restricted matches: Suspended or shadowbanned accounts with a matching username or email identifier',
      ),
    );
    expect(
      await screen.findByText(
        'Suspended or shadowbanned accounts with a matching username or email identifier',
      ),
    ).toBeVisible();
    expect(screen.getByRole('table').querySelector('tbody')).toHaveTextContent(
      'Hidden',
    );
  });
});
