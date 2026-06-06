import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import AdminUser from '@/modules/admin/client/components/AdminUser.component';
import * as usersApi from '@/modules/admin/client/api/users.api';

jest.mock('@/modules/admin/client/api/users.api');
jest.mock('@/modules/admin/client/components/AdminNotes', () => {
  const React = require('react');

  function MockAdminNotes({ id }) {
    return <section>Notes for {id}</section>;
  }

  MockAdminNotes.propTypes = {
    id: () => null,
  };

  return MockAdminNotes;
});
jest.mock('@/modules/admin/client/components/Json.component', () => {
  const React = require('react');

  function MockJson({ content }) {
    return <pre>{JSON.stringify(content)}</pre>;
  }

  MockJson.propTypes = {
    content: () => null,
  };

  return MockJson;
});
jest.mock(
  '@/modules/admin/client/components/UserEmailConfirmLink.component',
  () => {
    const React = require('react');

    function MockUserEmailConfirmLink({ user }) {
      return (
        <div>Email confirmation for {user.emailTemporary || user.email}</div>
      );
    }

    MockUserEmailConfirmLink.propTypes = {
      user: () => null,
    };

    return MockUserEmailConfirmLink;
  },
);
jest.mock('@/modules/admin/client/components/UserState.component', () => {
  const React = require('react');

  function MockUserState({ user }) {
    return <div>State for {user.username}</div>;
  }

  MockUserState.propTypes = {
    user: () => null,
  };

  return MockUserState;
});

const originalConfirm = window.confirm;
const userId = '111111111111111111111111';

afterEach(() => {
  jest.clearAllMocks();
  window.confirm = originalConfirm;
  window.history.pushState({}, '', '/');
});

const makeReportCard = overrides => ({
  contacts: [],
  messageFromCount: 3,
  messageToCount: 4,
  offers: [],
  profile: {
    _id: userId,
    displayName: 'Alice Example',
    email: 'alice@example.org',
    emailTemporary: 'alice-new@example.org',
    roles: ['user', 'moderator'],
    username: 'alice',
  },
  threadCount: 5,
  threadReferencesReceivedNo: 1,
  threadReferencesReceivedYes: 2,
  threadReferencesSentNo: 3,
  threadReferencesSentYes: 4,
  ...overrides,
});

describe('<AdminUser />', () => {
  it('handles role helpers safely before a profile has loaded', () => {
    const component = new AdminUser({});

    expect(component.hasRole('moderator')).toBe(false);
    expect(() => component.handleUserRoleChange('moderator')).not.toThrow();
    expect(usersApi.setUserRole).not.toHaveBeenCalled();

    component.state.user = {
      profile: {
        roles: ['moderator'],
      },
    };

    expect(component.hasRole('moderator')).toBe(true);
  });

  it('loads a valid member id from the URL and renders the report card', async () => {
    window.history.pushState({}, '', `/admin/user?id=${userId}`);
    usersApi.getUser.mockResolvedValueOnce(
      makeReportCard({
        contacts: [{ _id: 'contact-1', user: 'bob' }],
        offers: [
          {
            _id: 'offer-1',
            location: [24.94, 60.17],
            type: 'host',
          },
        ],
      }),
    );

    render(<AdminUser />);

    expect(screen.getByLabelText('Member ID')).toHaveValue(userId);
    expect(await screen.findByText('Alice Example')).toBeInTheDocument();
    expect(usersApi.getUser).toHaveBeenCalledWith(userId);
    expect(screen.getByText('State for alice')).toBeInTheDocument();
    expect(screen.getByText('3 sent')).toBeInTheDocument();
    expect(screen.getByText('4 received')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '5 threads total' }),
    ).toHaveAttribute('href', `/admin/threads?userId=${userId}`);
    expect(
      screen.getByText('Notes for 111111111111111111111111'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Show offer on map' }),
    ).toHaveAttribute('href', '/search?offer=offer-1');
    expect(
      screen.getByRole('link', { name: 'Show location on map' }),
    ).toHaveAttribute('href', '/search?location=60.17,24.94');
  });

  it('updates the URL while typing and only queries valid member ids', async () => {
    usersApi.getUser.mockResolvedValueOnce(makeReportCard());

    render(<AdminUser />);

    const input = screen.getByLabelText('Member ID');
    const showButton = screen.getByRole('button', { name: 'Show' });

    expect(showButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'short-id' } });

    expect(window.location.search).toBe('?id=short-id');
    expect(showButton).toBeDisabled();
    expect(usersApi.getUser).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: userId } });
    fireEvent.click(showButton);

    await waitFor(() => expect(usersApi.getUser).toHaveBeenCalledWith(userId));
  });

  it('submits short ids without querying the API', () => {
    render(<AdminUser />);

    const input = screen.getByLabelText('Member ID');
    fireEvent.change(input, { target: { value: 'short-id' } });
    fireEvent.submit(input.closest('form'));

    expect(usersApi.getUser).not.toHaveBeenCalled();
  });

  it('uses profile username and id fallbacks for report headings and counts', async () => {
    usersApi.getUser
      .mockResolvedValueOnce(
        makeReportCard({
          messageFromCount: undefined,
          messageToCount: undefined,
          profile: {
            _id: userId,
            email: 'alice@example.org',
            roles: [],
            username: 'alice',
          },
          threadCount: undefined,
        }),
      )
      .mockResolvedValueOnce(
        makeReportCard({
          profile: {
            _id: userId,
            email: 'alice@example.org',
            roles: [],
          },
        }),
      );

    const { rerender } = render(<AdminUser />);

    fireEvent.change(screen.getByLabelText('Member ID'), {
      target: { value: userId },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));

    expect(await screen.findByText('alice')).toBeInTheDocument();
    expect(screen.getByText('0 sent')).toBeInTheDocument();
    expect(screen.getByText('0 received')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '0 threads total' }),
    ).toHaveAttribute('href', `/admin/threads?userId=${userId}`);

    rerender(<AdminUser />);
    fireEvent.change(screen.getByLabelText('Member ID'), {
      target: { value: userId },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));

    expect(await screen.findByText(userId)).toBeInTheDocument();
  });

  it('changes a member role after confirmation and refreshes the profile', async () => {
    window.confirm = jest.fn(() => true);
    usersApi.getUser.mockResolvedValue(
      makeReportCard({
        profile: {
          _id: userId,
          displayName: 'Alice Example',
          email: 'alice@example.org',
          roles: ['user'],
          username: 'alice',
        },
      }),
    );
    usersApi.setUserRole.mockResolvedValueOnce({});

    render(<AdminUser />);

    fireEvent.change(screen.getByLabelText('Member ID'), {
      target: { value: userId },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));

    await screen.findByText('Alice Example');
    fireEvent.click(screen.getByRole('button', { name: 'Suspend' }));

    expect(window.confirm).toHaveBeenCalledWith('Set alice role to suspended?');
    await waitFor(() =>
      expect(usersApi.setUserRole).toHaveBeenCalledWith(userId, 'suspended'),
    );
    await waitFor(() => expect(usersApi.getUser).toHaveBeenCalledTimes(2));
  });

  it('does not change roles when confirmation is declined', async () => {
    window.confirm = jest.fn(() => false);
    usersApi.getUser.mockResolvedValueOnce(
      makeReportCard({
        profile: {
          _id: userId,
          displayName: 'Alice Example',
          email: 'alice@example.org',
          roles: ['user'],
          username: 'alice',
        },
      }),
    );

    render(<AdminUser />);

    fireEvent.change(screen.getByLabelText('Member ID'), {
      target: { value: userId },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));

    await screen.findByText('Alice Example');
    fireEvent.click(screen.getByRole('button', { name: 'Suspend' }));

    expect(usersApi.setUserRole).not.toHaveBeenCalled();
  });
});
