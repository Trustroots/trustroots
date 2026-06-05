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

    expect(button).toBeDisabled();

    fireEvent.change(input, { target: { value: 'al' } });
    fireEvent.click(button);

    expect(window.location.search).toBe('?search=al');
    expect(usersApi.searchUsers).not.toHaveBeenCalled();
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
