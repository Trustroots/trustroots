import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import AdminSearchUsers from '@/modules/admin/client/components/AdminSearchUsers.component';
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
    const component = new AdminSearchUsers({});
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

    expect(await screen.findByText('Alice 0')).toHaveAttribute(
      'href',
      '/admin/user?id=123456789012345678901200',
    );
    expect(usersApi.searchUsers).toHaveBeenCalledWith('alice');
    expect(screen.getByText('50 user(s).')).toBeInTheDocument();
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

    expect(await screen.findByText('Boundary Search')).toHaveAttribute(
      'href',
      '/admin/user?id=searchsearchsearchsearch0001',
    );
    expect(usersApi.searchUsers).toHaveBeenCalledWith('ali');
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

    expect(await screen.findByText('Volunteer Example')).toHaveAttribute(
      'href',
      '/admin/user?id=abcdefabcdefabcdefabcdef',
    );
    expect(usersApi.listUsersByRole).toHaveBeenCalledWith('volunteer');
    expect(screen.getByText('new@example.org')).toBeInTheDocument();
    expect(screen.getByText('(temporary email)')).toBeInTheDocument();
  });
});
