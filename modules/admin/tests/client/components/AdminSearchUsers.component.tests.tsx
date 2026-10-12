import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminSearchUsers, {
  AdminSearchUsersContent,
} from '@/modules/admin/client/components/AdminSearchUsers.component';
import * as usersApi from '@/modules/admin/client/api/users.api';
import AdminUserResultsTable from '@/modules/admin/client/components/AdminUserResultsTable.component';

jest.mock('@/modules/admin/client/api/users.api');
const mockedUsersApi = jest.mocked(usersApi);

type SearchUserFixture = React.ComponentProps<
  typeof AdminUserResultsTable
>['userResults'][number] & {
  displayName?: string;
  public?: boolean;
  roles?: string[];
  emailTemporary?: string;
};

type MemberListFixture = {
  pagination: NonNullable<
    React.ComponentProps<typeof AdminUserResultsTable>['pagination']
  >;
  sort: React.ComponentProps<typeof AdminUserResultsTable>['sort'];
  users: SearchUserFixture[];
};

afterEach(() => {
  jest.clearAllMocks();
  window.history.pushState({}, '', '/');
});

const makeUser = (
  overrides: Partial<SearchUserFixture> = {},
): SearchUserFixture => ({
  _id: '123456789012345678901234',
  created: '2024-01-15T12:00:00.000Z',
  displayName: 'Alice Example',
  email: 'alice@example.org',
  emailTemporary: '',
  public: true,
  roles: ['user'],
  username: 'alice',
  ...overrides,
});

const makeMemberList = (
  users: SearchUserFixture[],
  overrides: Partial<MemberListFixture> = {},
): MemberListFixture => ({
  pagination: {
    page: 1,
    pageSize: 150,
    total: users.length,
    totalPages: users.length ? 1 : 0,
  },
  sort: {
    column: 'username',
    direction: 'ascending',
  },
  users,
  ...overrides,
});

function mockImmediateSetState(component: AdminSearchUsersContent) {
  jest.spyOn(component, 'setState').mockImplementation((update, callback) => {
    const nextState =
      typeof update === 'function'
        ? update(component.state, component.props)
        : update;
    if (nextState) {
      component.state = { ...component.state, ...nextState };
    }
    callback?.();
  });
}

describe('<AdminSearchUsers />', () => {
  it('lists users by role when called without a form event', async () => {
    const userResults = [makeUser({ displayName: 'Direct Admin' })];
    mockedUsersApi.listUsersByRole.mockResolvedValueOnce(
      makeMemberList(userResults),
    );
    const component = new AdminSearchUsersContent({});
    mockImmediateSetState(component);

    await component.doListUsersByRole();

    expect(mockedUsersApi.listUsersByRole).toHaveBeenCalledWith('admin', {
      page: 1,
      sort: { column: 'username', direction: 'ascending' },
    });
    expect(component.setState).toHaveBeenCalledWith({
      sort: { column: 'username', direction: 'ascending' },
      userResults,
      userResultsPagination: {
        page: 1,
        pageSize: 150,
        total: 1,
        totalPages: 1,
      },
      userResultsSource: 'role',
    });
  });

  it('normalises a direct search before querying', async () => {
    mockedUsersApi.searchUsers.mockResolvedValueOnce(makeMemberList([]));
    const component = new AdminSearchUsersContent({});
    component.state = { ...component.state, search: '  alice  ' };
    mockImmediateSetState(component);

    await component.doSearch();

    expect(component.setState).toHaveBeenCalledWith({ search: 'alice' });
    expect(mockedUsersApi.searchUsers).toHaveBeenCalledWith('alice', {
      page: 1,
      sort: { column: 'username', direction: 'ascending' },
    });
  });

  it('removes an empty normalised search from the URL', async () => {
    window.history.pushState({}, '', '/admin/search-users?search=old');
    const component = new AdminSearchUsersContent({});
    component.state = { ...component.state, search: '   ' };
    mockImmediateSetState(component);

    await component.doSearch();

    expect(component.setState).toHaveBeenCalledWith({ search: '' });
    expect(window.location.search).toBe('');
    expect(mockedUsersApi.searchUsers).not.toHaveBeenCalled();
  });

  it('does not show legacy moderator as a listable role', () => {
    render(<AdminSearchUsers />);

    expect(screen.getByRole('combobox')).not.toHaveTextContent('moderator');
  });

  it('runs an initial search from the URL and renders result details', async () => {
    window.history.pushState({}, '', '/admin/search-users?search=alice');
    mockedUsersApi.searchUsers.mockResolvedValueOnce(
      makeMemberList(
        Array.from({ length: 150 }, (_, index) =>
          makeUser({
            _id: `1234567890123456789012${String(index).padStart(2, '0')}`,
            displayName: `Alice ${index}`,
            username: `alice${index}`,
          }),
        ),
        {
          pagination: {
            page: 1,
            pageSize: 150,
            total: 151,
            totalPages: 2,
          },
        },
      ),
    );

    render(<AdminSearchUsers />);

    expect(await screen.findByText('alice0 (Alice 0)')).toHaveAttribute(
      'href',
      '/admin/user/alice0',
    );
    expect(mockedUsersApi.searchUsers).toHaveBeenCalledWith('alice', {
      page: 1,
      sort: { column: 'username', direction: 'ascending' },
    });
    expect(screen.getByText('151 user(s). Page 1 of 2.')).toBeInTheDocument();
    expect(screen.getAllByText('2024-01-15')).toHaveLength(150);
    expect(screen.queryByText('ID')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('loads the selected role from a direct URL', async () => {
    window.history.pushState({}, '', '/admin/search-users?role=welcome-team');
    mockedUsersApi.listUsersByRole.mockResolvedValueOnce(
      makeMemberList([makeUser({ username: 'greeter-one' })]),
    );

    render(<AdminSearchUsers />);

    expect(
      await screen.findByText('greeter-one (Alice Example)'),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('welcome-team');
    expect(mockedUsersApi.listUsersByRole).toHaveBeenCalledWith(
      'welcome-team',
      {
        page: 1,
        sort: { column: 'username', direction: 'ascending' },
      },
    );
  });

  it('updates the role URL on list submit and clears the role for text search', async () => {
    window.history.pushState({}, '', '/admin/search-users?role=admin');
    mockedUsersApi.listUsersByRole.mockResolvedValue(
      makeMemberList([makeUser({ username: 'selected-volunteer' })]),
    );
    mockedUsersApi.searchUsers.mockResolvedValueOnce(
      makeMemberList([makeUser({ username: 'searched-member' })]),
    );
    render(<AdminSearchUsers />);

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'volunteer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'List users in role' }));
    expect(
      await screen.findByText('selected-volunteer (Alice Example)'),
    ).toBeInTheDocument();
    expect(window.location.search).toBe('?role=volunteer');
    expect(mockedUsersApi.listUsersByRole).toHaveBeenCalledWith('volunteer', {
      page: 1,
      sort: { column: 'username', direction: 'ascending' },
    });

    fireEvent.change(screen.getByLabelText('Name, username or email'), {
      target: { value: 'alice' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(
      await screen.findByText('searched-member (Alice Example)'),
    ).toBeInTheDocument();
    expect(window.location.search).toBe('?search=alice');
    expect(mockedUsersApi.searchUsers).toHaveBeenCalledWith('alice', {
      page: 1,
      sort: { column: 'username', direction: 'ascending' },
    });
  });

  it('updates the URL on submit and blocks too-short searches', () => {
    render(<AdminSearchUsers />);

    const input = screen.getByLabelText('Name, username or email');
    const button = screen.getByRole('button', { name: 'Search' });
    const form = input.closest('form');

    expect(button).toBeDisabled();

    fireEvent.change(input, { target: { value: 'al' } });
    expect(window.location.search).toBe('');
    fireEvent.submit(form!);

    expect(window.location.search).toBe('?search=al');
    expect(mockedUsersApi.searchUsers).not.toHaveBeenCalled();
  });

  it('keeps spaces while typing and trims surrounding whitespace on submit', async () => {
    mockedUsersApi.searchUsers.mockResolvedValueOnce(
      makeMemberList([makeUser({ username: 'trimmed-search' })]),
    );
    render(<AdminSearchUsers />);

    const input = screen.getByLabelText('Name, username or email');
    fireEvent.change(input, { target: { value: 'trustroots' } });
    fireEvent.change(input, { target: { value: 'trustroots ' } });

    expect(input).toHaveValue('trustroots ');

    fireEvent.change(input, { target: { value: 'trustroots team ' } });

    expect(input).toHaveValue('trustroots team ');
    expect(window.location.search).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(input).toHaveValue('trustroots team');
    expect(window.location.search).toBe('?search=trustroots+team');
    expect(
      await screen.findByText('trimmed-search (Alice Example)'),
    ).toBeInTheDocument();
    expect(mockedUsersApi.searchUsers).toHaveBeenCalledWith('trustroots team', {
      page: 1,
      sort: { column: 'username', direction: 'ascending' },
    });
  });

  it('searches from the submitted form once the search text is long enough', async () => {
    mockedUsersApi.searchUsers.mockResolvedValueOnce(
      makeMemberList([
        makeUser({
          _id: 'searchsearchsearchsearch0001',
          displayName: 'Boundary Search',
          username: 'boundary',
        }),
      ]),
    );

    render(<AdminSearchUsers />);

    fireEvent.change(screen.getByLabelText('Name, username or email'), {
      target: { value: 'ali' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(
      await screen.findByText('boundary (Boundary Search)'),
    ).toHaveAttribute('href', '/admin/user/boundary');
    expect(mockedUsersApi.searchUsers).toHaveBeenCalledWith('ali', {
      page: 1,
      sort: { column: 'username', direction: 'ascending' },
    });
  });

  it('hides obvious spam users from text search results', async () => {
    mockedUsersApi.searchUsers.mockResolvedValueOnce(
      makeMemberList([
        makeUser({
          _id: 'spamspamspamspamspam0001',
          displayName: 'Hot Daria Wants To Date',
          email: 'feedonthefriction+3@hotmail.com',
          emailTemporary: 'feedonthefriction+3@hotmail.com',
          public: false,
          roles: ['user', 'suspended'],
          username: '24721768s',
        }),
        makeUser({
          _id: 'realrealrealrealreal0001',
          displayName: 'The Friender',
          email: 'friend@example.org',
          username: 'thefri',
        }),
        makeUser({
          _id: 'spamspamspamspamspam0002',
          displayName:
            'Pretty Jenifer is waiting for your gaze https://bit.ly/jennig',
          email: 'jenifer@example.org',
          username: 'as2372978',
        }),
      ]),
    );

    render(<AdminSearchUsers />);

    fireEvent.change(screen.getByLabelText('Name, username or email'), {
      target: { value: 'thefri' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(
      await screen.findByText('thefri (The Friender)'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Hot Daria Wants To Date'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Pretty Jenifer is waiting/),
    ).not.toBeInTheDocument();
    expect(screen.getByText('3 user(s). Page 1 of 1.')).toBeInTheDocument();
    expect(screen.getByText('2 likely spam hidden.')).toBeInTheDocument();
  });

  it('reveals obvious spam users from text search results when toggled off', async () => {
    mockedUsersApi.searchUsers.mockResolvedValueOnce(
      makeMemberList([
        makeUser({
          _id: 'spamspamspamspamspam0001',
          displayName: 'Hot Daria Wants To Date',
          email: 'feedonthefriction+3@hotmail.com',
          emailTemporary: 'feedonthefriction+3@hotmail.com',
          public: false,
          roles: ['user', 'suspended'],
          username: '24721768s',
        }),
        makeUser({
          _id: 'realrealrealrealreal0001',
          displayName: 'The Friender',
          email: 'friend@example.org',
          username: 'thefri',
        }),
      ]),
    );

    render(<AdminSearchUsers />);

    fireEvent.change(screen.getByLabelText('Name, username or email'), {
      target: { value: 'thefri' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(
      await screen.findByText('thefri (The Friender)'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('24721768s (Hot Daria Wants To Date)'),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Hide obvious spam'));

    expect(
      screen.getByText('24721768s (Hot Daria Wants To Date)'),
    ).toBeInTheDocument();
    expect(screen.getByText('2 user(s). Page 1 of 1.')).toBeInTheDocument();
    expect(screen.queryByText('1 likely spam hidden.')).not.toBeInTheDocument();
    expect(mockedUsersApi.searchUsers).toHaveBeenCalledTimes(1);
  });

  it('lists users by role and renders temporary email state', async () => {
    mockedUsersApi.listUsersByRole.mockResolvedValueOnce(
      makeMemberList([
        makeUser({
          _id: 'abcdefabcdefabcdefabcdef',
          displayName: 'Volunteer Example',
          email: 'old@example.org',
          emailTemporary: 'new@example.org',
          roles: ['user', 'volunteer'],
          username: 'volunteer',
        }),
      ]),
    );

    render(<AdminSearchUsers />);

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'volunteer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'List users in role' }));

    expect(
      await screen.findByText('volunteer (Volunteer Example)'),
    ).toHaveAttribute('href', '/admin/user/volunteer');
    expect(mockedUsersApi.listUsersByRole).toHaveBeenCalledWith('volunteer', {
      page: 1,
      sort: { column: 'username', direction: 'ascending' },
    });
    expect(screen.getByText('new@example.org')).toBeInTheDocument();
    expect(screen.getByText('(temporary email)')).toBeInTheDocument();
  });

  it('paginates and server-sorts a role list', async () => {
    const firstPageUser = makeUser({
      _id: '111111111111111111111111',
      username: 'first-page',
    });
    const secondPageUser = makeUser({
      _id: '222222222222222222222222',
      username: 'second-page',
    });
    mockedUsersApi.listUsersByRole
      .mockResolvedValueOnce(
        makeMemberList([firstPageUser], {
          pagination: {
            page: 1,
            pageSize: 150,
            total: 151,
            totalPages: 2,
          },
        }),
      )
      .mockResolvedValueOnce(
        makeMemberList([secondPageUser], {
          pagination: {
            page: 2,
            pageSize: 150,
            total: 151,
            totalPages: 2,
          },
        }),
      )
      .mockResolvedValueOnce(
        makeMemberList(
          [
            makeUser({
              _id: '333333333333333333333333',
              username: 'sorted-role',
            }),
          ],
          {
            sort: { column: 'displayName', direction: 'ascending' },
          },
        ),
      );

    render(<AdminSearchUsers />);

    fireEvent.click(screen.getByRole('button', { name: 'List users in role' }));
    expect(
      await screen.findByRole('link', {
        name: 'first-page (Alice Example)',
      }),
    ).toBeInTheDocument();
    const historyLengthAfterSelectingRole = window.history.length;

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      await screen.findByRole('link', {
        name: 'second-page (Alice Example)',
      }),
    ).toBeInTheDocument();
    expect(mockedUsersApi.listUsersByRole).toHaveBeenNthCalledWith(2, 'admin', {
      page: 2,
      sort: { column: 'username', direction: 'ascending' },
    });
    expect(window.history.length).toBe(historyLengthAfterSelectingRole);

    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(
      await screen.findByRole('link', {
        name: 'sorted-role (Alice Example)',
      }),
    ).toBeInTheDocument();
    expect(mockedUsersApi.listUsersByRole).toHaveBeenNthCalledWith(3, 'admin', {
      page: 1,
      sort: { column: 'displayName', direction: 'ascending' },
    });
    expect(window.history.length).toBe(historyLengthAfterSelectingRole);
  });

  it('retains server sorting while paginating search results', async () => {
    const result = makeUser({ username: 'search-result' });
    mockedUsersApi.searchUsers
      .mockResolvedValueOnce(
        makeMemberList([result], {
          pagination: {
            page: 1,
            pageSize: 150,
            total: 151,
            totalPages: 2,
          },
        }),
      )
      .mockResolvedValueOnce(
        makeMemberList([makeUser({ username: 'sorted-search' })], {
          pagination: {
            page: 1,
            pageSize: 150,
            total: 151,
            totalPages: 2,
          },
          sort: { column: 'email', direction: 'ascending' },
        }),
      )
      .mockResolvedValueOnce(
        makeMemberList([makeUser({ username: 'page-two-search' })], {
          pagination: {
            page: 2,
            pageSize: 150,
            total: 151,
            totalPages: 2,
          },
          sort: { column: 'email', direction: 'ascending' },
        }),
      );

    render(<AdminSearchUsers />);
    fireEvent.change(screen.getByLabelText('Name, username or email'), {
      target: { value: 'search results' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(
      await screen.findByRole('link', {
        name: 'search-result (Alice Example)',
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Email' }));
    expect(
      await screen.findByRole('link', {
        name: 'sorted-search (Alice Example)',
      }),
    ).toBeInTheDocument();
    expect(mockedUsersApi.searchUsers).toHaveBeenNthCalledWith(
      2,
      'search results',
      {
        page: 1,
        sort: { column: 'email', direction: 'ascending' },
      },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      await screen.findByRole('link', {
        name: 'page-two-search (Alice Example)',
      }),
    ).toBeInTheDocument();
    expect(mockedUsersApi.searchUsers).toHaveBeenNthCalledWith(
      3,
      'search results',
      {
        page: 2,
        sort: { column: 'email', direction: 'ascending' },
      },
    );
  });

  it('does not hide obvious spam users from role lists', async () => {
    mockedUsersApi.listUsersByRole.mockResolvedValueOnce(
      makeMemberList([
        makeUser({
          _id: 'spamspamspamspamspam0001',
          displayName: 'Hot Daria Wants To Date',
          email: 'feedonthefriction+3@hotmail.com',
          emailTemporary: 'feedonthefriction+3@hotmail.com',
          public: false,
          roles: ['user', 'suspended'],
          username: '24721768s',
        }),
      ]),
    );

    render(<AdminSearchUsers />);

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'suspended' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'List users in role' }));

    expect(
      await screen.findByText('24721768s (Hot Daria Wants To Date)'),
    ).toBeInTheDocument();
    expect(screen.getByText('1 user(s). Page 1 of 1.')).toBeInTheDocument();
    expect(screen.queryByText('1 likely spam hidden.')).not.toBeInTheDocument();
  });

  it('hides public profile links for suspended members in search results', async () => {
    mockedUsersApi.searchUsers.mockResolvedValueOnce(
      makeMemberList([
        makeUser({
          _id: '123456789012345678901235',
          displayName: 'Suspended member',
          email: 'suspended@example.org',
          username: 'suspended-member',
          roles: ['user', 'suspended'],
        }),
      ]),
    );

    render(<AdminSearchUsers />);

    fireEvent.change(screen.getByLabelText('Name, username or email'), {
      target: { value: 'suspended-member' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(
      await screen.findByText('suspended-member (Suspended member)'),
    ).toHaveAttribute('href', '/admin/user/suspended-member');
    expect(
      screen.queryByRole('link', { name: 'Public profile' }),
    ).not.toBeInTheDocument();
  });
});
