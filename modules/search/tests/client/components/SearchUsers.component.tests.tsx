import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import '@/config/client/i18n';
import SearchUsers from '@/modules/search/client/components/SearchUsers.component';
import type { MemberSearchFilters } from '@/modules/users/client/api/search-users.api';
import type { UserProfile } from '@/modules/users/client/types';

type MockSearchResponse = { data: UserProfile[] | null };
const mockSearchUsers =
  vi.fn<
    (
      ...args: [query: string, filters: MemberSearchFilters]
    ) => Promise<MockSearchResponse>
  >();

vi.mock('@tanstack/react-router', async () =>
  (
    await import('@/testutils/client/router-location.testutil')
  ).mockRouterModule(),
);
vi.mock('@/modules/users/client/api/search-users.api', () => ({
  searchUsers: (query: string, filters: MemberSearchFilters) =>
    mockSearchUsers(query, filters),
}));

vi.mock('@/modules/tribes/client/api/tribes.api', () => ({
  read: async () => [{ _id: 'circle-1', label: 'Example circle' }],
}));
vi.mock(
  '@/modules/search/client/components/SearchFilterLanguage.component',
  () => ({
    default: ({
      onChangeLanguages,
    }: {
      onChangeLanguages: (languages: string[]) => void;
    }) => (
      <button type="button" onClick={() => onChangeLanguages(['eng', 'fra'])}>
        Set spoken languages
      </button>
    ),
  }),
);

afterEach(() => {
  mockSearchUsers.mockReset();
});

function renderSearch() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <SearchUsers />
    </QueryClientProvider>,
  );
}

const defaults = {
  connectionsOnly: false,
  types: [],
  volunteering: false,
  onlineRecently: false,
  tribes: [],
  languages: [],
} satisfies MemberSearchFilters;

describe('<SearchUsers />', () => {
  beforeEach(() => {
    window.history.pushState({}, 'Search', '/search/members');
  });

  it('keeps search controls disabled until the query is long enough', () => {
    renderSearch();

    const input = screen.getByRole('textbox', { name: 'Search members' });
    expect(input).not.toHaveFocus();
    expect(input).toHaveAttribute('maxlength', '120');
    const searchButton = screen.getByRole('button', {
      name: 'Search members',
    });
    const clearButton = screen.getByRole('button', {
      name: 'Clear members search',
    });

    expect(searchButton).toBeDisabled();
    expect(clearButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'al' } });

    expect(searchButton).toBeDisabled();
    expect(clearButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'ali' } });

    expect(searchButton).toBeEnabled();
    expect(clearButton).toBeEnabled();
  });

  it('submits a member search and renders user results', async () => {
    mockSearchUsers.mockResolvedValueOnce({
      data: [
        {
          _id: 'user-1',
          avatarSource: 'none',
          displayName: 'Alice Example',
          username: 'alice',
        },
      ],
    });

    renderSearch();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search members' }), {
      target: { value: 'alice' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search members' }));

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(
      screen.getByRole('heading', { name: 'Searching members…' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(mockSearchUsers).toHaveBeenCalledWith('alice', defaults),
    );

    expect(await screen.findByText('1 members found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Alice Example/ })).toHaveAttribute(
      'href',
      '/profile/alice',
    );
  });

  it('runs an initial search from the URL search parameter', async () => {
    window.history.pushState({}, 'Search', '/search/members?search=traveler');
    mockSearchUsers.mockResolvedValueOnce({ data: [] });

    renderSearch();

    expect(screen.getByRole('textbox', { name: 'Search members' })).toHaveValue(
      'traveler',
    );
    await waitFor(() =>
      expect(mockSearchUsers).toHaveBeenCalledWith('traveler', defaults),
    );
    expect(await screen.findByText('No members found.')).toBeInTheDocument();
  });

  it('shows empty results when the search response has no users array', async () => {
    mockSearchUsers.mockResolvedValueOnce({ data: null });

    renderSearch();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search members' }), {
      target: { value: 'alice' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search members' }));

    await waitFor(() =>
      expect(mockSearchUsers).toHaveBeenCalledWith('alice', defaults),
    );
    expect(await screen.findByText('No members found.')).toBeInTheDocument();
  });

  it('does not request users for short URL searches', () => {
    window.history.pushState({}, 'Search', '/search/members?search=ab');

    renderSearch();

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'My connections only' }),
    );
    expect(mockSearchUsers).not.toHaveBeenCalled();
    expect(screen.getByText('No members found.')).toBeInTheDocument();
  });

  it('clears the current query and rendered results', async () => {
    mockSearchUsers.mockResolvedValueOnce({
      data: [
        {
          _id: 'user-1',
          avatarSource: 'none',
          displayName: 'Alice Example',
          username: 'alice',
        },
      ],
    });

    renderSearch();

    const input = screen.getByRole('textbox', { name: 'Search members' });
    fireEvent.change(input, { target: { value: 'alice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search members' }));

    expect(await screen.findByText('1 members found')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Clear members search' }),
    );

    expect(input).toHaveValue('');
    expect(screen.queryByText('1 members found')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Search members' }),
    ).toBeDisabled();
  });

  it('announces a failed search and retries accessibly', async () => {
    mockSearchUsers
      .mockRejectedValueOnce(new Error('Search failed'))
      .mockResolvedValueOnce({
        data: [
          {
            _id: 'user-1',
            avatarSource: 'none',
            displayName: 'Alice Example',
            username: 'alice',
          },
        ],
      });

    renderSearch();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search members' }), {
      target: { value: 'alice' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search members' }));

    await waitFor(() =>
      expect(mockSearchUsers).toHaveBeenCalledWith('alice', defaults),
    );
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('Member search unavailable');
    expect(error).toHaveTextContent('Could not search members.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('1 members found')).toBeInTheDocument();
    expect(mockSearchUsers).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('No members found.')).not.toBeInTheDocument();
  });
});

it('searches again when the connections filter changes after a completed search', async () => {
  window.history.pushState({}, 'Search', '/search/members');
  mockSearchUsers.mockResolvedValue({ data: [] });
  renderSearch();

  const contacts = screen.getByRole('checkbox', {
    name: 'My connections only',
  });
  fireEvent.click(contacts);
  expect(mockSearchUsers).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Search members' }), {
    target: { value: 'Exampleville' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Search members' }));
  await waitFor(() =>
    expect(mockSearchUsers).toHaveBeenLastCalledWith('Exampleville', {
      ...defaults,
      connectionsOnly: true,
    }),
  );

  fireEvent.click(contacts);
  await waitFor(() =>
    expect(mockSearchUsers).toHaveBeenLastCalledWith('Exampleville', defaults),
  );
});

it('shares the submitted query and filters while preserving the existing URL state', async () => {
  window.history.pushState({}, '', '/search/members?source=map#location');
  mockSearchUsers.mockResolvedValue({ data: [] });
  renderSearch();

  const input = screen.getByRole('textbox', { name: 'Search members' });
  fireEvent.change(input, { target: { value: ' Exampleville ' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Hosts' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Meetings' }));
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Offers volunteering' }),
  );
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Online in the past 6 months' }),
  );
  fireEvent.click(screen.getByText('Circles and languages'));
  fireEvent.click(
    await screen.findByRole('checkbox', { name: 'Example circle' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Set spoken languages' }));

  expect(mockSearchUsers).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Search members' }));
  expect(await screen.findByText('No members found.')).toBeInTheDocument();
  expect(mockSearchUsers).toHaveBeenLastCalledWith('Exampleville', {
    ...defaults,
    types: ['host', 'meet'],
    volunteering: true,
    onlineRecently: true,
    tribes: ['circle-1'],
    languages: ['eng', 'fra'],
  });
  expect(
    Object.fromEntries(new URLSearchParams(window.location.search)),
  ).toEqual({
    source: 'map',
    search: 'Exampleville',
    types: 'host,meet',
    volunteering: 'true',
    onlineRecently: 'true',
    tribes: 'circle-1',
    languages: 'eng,fra',
  });
  expect(window.location.hash).toBe('#location');

  fireEvent.click(screen.getByRole('button', { name: 'Clear members search' }));
  expect(input).toHaveValue('');
  expect(new URLSearchParams(window.location.search).has('search')).toBe(false);
  expect(screen.getByRole('checkbox', { name: 'Hosts' })).toBeChecked();
});

it('restores the query and filters when navigating through search history', async () => {
  window.history.pushState(
    {},
    '',
    '/search/members?search=Exampleville&types=meet&connectionsOnly=true',
  );
  mockSearchUsers.mockResolvedValue({ data: [] });
  renderSearch();
  const meetings = screen.getByRole('checkbox', { name: 'Meetings' });
  expect(meetings).toBeChecked();
  expect(
    screen.getByRole('checkbox', { name: 'My connections only' }),
  ).toBeChecked();

  await waitFor(() =>
    expect(mockSearchUsers).toHaveBeenLastCalledWith('Exampleville', {
      ...defaults,
      connectionsOnly: true,
      types: ['meet'],
    }),
  );

  act(() => {
    window.history.pushState(
      {},
      '',
      '/search/members?search=Rivertown&types=host',
    );
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(screen.getByRole('textbox', { name: 'Search members' })).toHaveValue(
    'Rivertown',
  );
  expect(meetings).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Hosts' })).toBeChecked();

  await act(async () => {
    await new Promise<void>(resolve => {
      window.addEventListener('popstate', () => resolve(), { once: true });
      window.history.back();
    });
  });

  expect(screen.getByRole('textbox', { name: 'Search members' })).toHaveValue(
    'Exampleville',
  );
  expect(meetings).toBeChecked();
});
