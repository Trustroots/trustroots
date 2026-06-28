import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import AdminSearchUsers, {
  AdminSearchUsersContent,
} from '@/modules/admin/client/components/AdminSearchUsers.component';
import * as usersApi from '@/modules/admin/client/api/users.api';

jest.mock('@/modules/admin/client/api/users.api');

afterEach(() => {
  jest.clearAllMocks();
  window.history.pushState({}, '', '/');
});

const makeUser = overrides => ({
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

describe('<AdminSearchUsers />', () => {
  it('lists users by role when called without a form event', async () => {
    const userResults = [makeUser({ displayName: 'Direct Admin' })];
    usersApi.listUsersByRole.mockResolvedValueOnce(userResults);
    const component = new AdminSearchUsersContent({});
    component.setState = jest.fn(update => {
      component.state = {
        ...component.state,
        ...update,
      };
    });

    await component.doListUsersByRole();

    expect(usersApi.listUsersByRole).toHaveBeenCalledWith('admin');
    expect(component.setState).toHaveBeenCalledWith({ userResults });
  });

  it('does not show legacy moderator as a listable role', () => {
    render(<AdminSearchUsers />);

    expect(screen.getByRole('combobox')).not.toHaveTextContent('moderator');
  });

  it('runs an initial search from the URL and renders result details', async () => {
    window.history.pushState({}, '', '/admin/search-users?search=alice');
    usersApi.searchUsers.mockResolvedValueOnce(
      Array.from({ length: 50 }, (_, index) =>
        makeUser({
          _id: `1234567890123456789012${String(index).padStart(2, '0')}`,
          displayName: `Alice ${index}`,
          username: `alice${index}`,
        }),
      ),
    );

    render(<AdminSearchUsers />);

    expect(await screen.findByText('alice0 (Alice 0)')).toHaveAttribute(
      'href',
      '/admin/user?id=123456789012345678901200',
    );
    expect(usersApi.searchUsers).toHaveBeenCalledWith('alice');
    expect(screen.getByText('50 user(s).')).toBeInTheDocument();
    expect(screen.getAllByText('2024-01-15')).toHaveLength(50);
    expect(screen.queryByText('ID')).not.toBeInTheDocument();
    expect(
      screen.getByText(/There might be more results but 50 is maximum./),
    ).toBeInTheDocument();
  });

  it('updates the URL while typing and blocks too-short searches', () => {
    render(<AdminSearchUsers />);

    const input = screen.getByLabelText('Name, username or email');
    const button = screen.getByRole('button', { name: 'Search' });
    const form = input.closest('form');

    expect(button).toBeDisabled();

    fireEvent.change(input, { target: { value: 'al' } });
    fireEvent.submit(form);

    expect(window.location.search).toBe('?search=al');
    expect(usersApi.searchUsers).not.toHaveBeenCalled();
  });

  it('searches from the submitted form once the search text is long enough', async () => {
    usersApi.searchUsers.mockResolvedValueOnce([
      makeUser({
        _id: 'searchsearchsearchsearch0001',
        displayName: 'Boundary Search',
        username: 'boundary',
      }),
    ]);

    render(<AdminSearchUsers />);

    fireEvent.change(screen.getByLabelText('Name, username or email'), {
      target: { value: 'ali' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(
      await screen.findByText('boundary (Boundary Search)'),
    ).toHaveAttribute('href', '/admin/user?id=searchsearchsearchsearch0001');
    expect(usersApi.searchUsers).toHaveBeenCalledWith('ali');
  });

  it('hides obvious spam users from text search results', async () => {
    usersApi.searchUsers.mockResolvedValueOnce([
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
    ]);

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
    expect(screen.getByText('1 user(s).')).toBeInTheDocument();
  });

  it('lists users by role and renders temporary email state', async () => {
    usersApi.listUsersByRole.mockResolvedValueOnce([
      makeUser({
        _id: 'abcdefabcdefabcdefabcdef',
        displayName: 'Volunteer Example',
        email: 'old@example.org',
        emailTemporary: 'new@example.org',
        roles: ['user', 'volunteer'],
        username: 'volunteer',
      }),
    ]);

    render(<AdminSearchUsers />);

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'volunteer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'List users in role' }));

    expect(
      await screen.findByText('volunteer (Volunteer Example)'),
    ).toHaveAttribute('href', '/admin/user?id=abcdefabcdefabcdefabcdef');
    expect(usersApi.listUsersByRole).toHaveBeenCalledWith('volunteer');
    expect(screen.getByText('new@example.org')).toBeInTheDocument();
    expect(screen.getByText('(temporary email)')).toBeInTheDocument();
  });

  it('hides public profile links for suspended members in search results', async () => {
    usersApi.searchUsers.mockResolvedValueOnce([
      makeUser({
        _id: '123456789012345678901235',
        displayName: 'Suspended member',
        email: 'suspended@example.org',
        username: 'suspended-member',
        roles: ['user', 'suspended'],
      }),
    ]);

    render(<AdminSearchUsers />);

    fireEvent.change(screen.getByLabelText('Name, username or email'), {
      target: { value: 'suspended-member' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(
      await screen.findByText('suspended-member (Suspended member)'),
    ).toHaveAttribute('href', '/admin/user?id=123456789012345678901235');
    expect(
      screen.queryByRole('link', { name: 'Public profile' }),
    ).not.toBeInTheDocument();
  });
});
