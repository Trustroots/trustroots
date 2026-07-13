import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
const otherUserId = '222222222222222222222222';

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
    roles: ['user'],
    username: 'alice',
  },
  threadCount: 5,
  threadReferencesReceivedNo: 1,
  threadReferencesReceivedYes: 2,
  threadReferencesSentNo: 3,
  threadReferencesSentYes: 4,
  ...overrides,
});

function submitMemberSearch(value) {
  const input = screen.getByLabelText('Member username, email or ID');
  fireEvent.change(input, { target: { value } });
  fireEvent.submit(input.closest('form'));
}

describe('<AdminUser />', () => {
  it('handles role helpers safely before a profile has loaded', () => {
    const component = new AdminUser({});

    expect(component.hasRole('volunteer')).toBe(false);
    expect(() => component.handleUserRoleChange('volunteer')).not.toThrow();
    expect(usersApi.setUserRole).not.toHaveBeenCalled();

    component.state.user = {
      profile: {
        roles: ['volunteer'],
      },
    };

    expect(component.hasRole('volunteer')).toBe(true);
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
        threadReferences: [
          {
            _id: 'reference-1',
            reference: 'yes',
            userFrom: {
              _id: otherUserId,
              displayName: 'Bob Example',
              username: 'bob',
            },
            userTo: {
              _id: userId,
              displayName: 'Alice Example',
              username: 'alice',
            },
          },
          {
            _id: 'reference-2',
            reference: 'no',
            userFrom: {
              _id: userId,
              displayName: 'Alice Example',
              username: 'alice',
            },
            userTo: {
              _id: otherUserId,
              displayName: 'Bob Example',
              username: 'bob',
            },
          },
        ],
      }),
    );

    render(<AdminUser />);

    expect(screen.getByLabelText('Member username, email or ID')).toHaveValue(
      userId,
    );
    expect(
      await screen.findByRole('heading', {
        name: 'Alice Example report card',
      }),
    ).toBeInTheDocument();
    expect(usersApi.getUser).toHaveBeenCalledWith(userId);
    expect(screen.getByText('State for alice')).toBeInTheDocument();
    expect(screen.getByText('3 sent')).toBeInTheDocument();
    expect(screen.getByText('4 received')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Public profile' }),
    ).toHaveAttribute('href', '/profile/alice');
    expect(
      screen.getByRole('row', { name: /Email alice@example.org/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'alice' })).toHaveAttribute(
      'href',
      '/profile/alice',
    );
    expect(screen.getByText('raw data')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '5 threads total' }),
    ).toHaveAttribute('href', `/admin/threads?userId=${userId}`);
    expect(screen.getByRole('link', { name: '2 positive' })).toHaveAttribute(
      'href',
      '#thread-votes-received-positive',
    );
    expect(screen.getByRole('link', { name: '3 negative' })).toHaveAttribute(
      'href',
      '#thread-votes-gave-negative',
    );
    expect(screen.getByText('Positive votes received')).toBeInTheDocument();
    expect(screen.getByText('Negative votes gave')).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: 'Read messages' })[0],
    ).toHaveAttribute(
      'href',
      `/admin/messages?userId1=${otherUserId}&userId2=${userId}`,
    );
    expect(
      screen.getAllByRole('link', { name: 'Read messages' })[1],
    ).toHaveAttribute(
      'href',
      `/admin/messages?userId1=${userId}&userId2=${otherUserId}`,
    );
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

  it('hides public profile and role actions for suspended members', async () => {
    usersApi.getUser.mockResolvedValueOnce(
      makeReportCard({
        profile: {
          _id: userId,
          email: 'alice@example.org',
          roles: ['user', 'suspended'],
          username: 'alice',
        },
        messageFromCount: 0,
        messageToCount: 0,
        threadCount: 0,
        threadReferencesReceivedNo: 0,
        threadReferencesReceivedYes: 0,
        threadReferencesSentNo: 0,
        threadReferencesSentYes: 0,
        offers: [],
        contacts: [],
      }),
    );

    window.history.pushState({}, '', `/admin/user?id=${userId}`);
    render(<AdminUser />);

    expect(
      await screen.findByRole('heading', { name: 'alice report card' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Public profile' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Shadow ban' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Make volunteer' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Make volunteer alumni' }),
    ).not.toBeInTheDocument();
  });

  it('updates the URL while typing and queries valid member ids', async () => {
    usersApi.getUser.mockResolvedValueOnce(makeReportCard());

    render(<AdminUser />);

    const input = screen.getByLabelText('Member username, email or ID');

    fireEvent.change(input, { target: { value: 'short-id' } });

    expect(window.location.search).toBe('?q=short-id');
    expect(usersApi.getUser).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '' } });

    expect(window.location.search).toBe('');

    submitMemberSearch(userId);

    await waitFor(() => expect(usersApi.getUser).toHaveBeenCalledWith(userId));
  });

  it('ignores invalid ids passed directly to the loader', async () => {
    const ref = React.createRef();

    render(<AdminUser ref={ref} />);

    await act(async () => {
      ref.current.getUserById('not-a-mongo-id');
    });

    expect(usersApi.getUser).not.toHaveBeenCalled();
  });

  it('loads a query from the URL', async () => {
    window.history.pushState({}, '', '/admin/user?q=alice');
    usersApi.searchUsers.mockResolvedValueOnce([
      {
        _id: userId,
        username: 'alice',
      },
    ]);
    usersApi.getUser.mockResolvedValueOnce(makeReportCard());

    render(<AdminUser />);

    expect(screen.getByLabelText('Member username, email or ID')).toHaveValue(
      'alice',
    );
    await waitFor(() =>
      expect(usersApi.searchUsers).toHaveBeenCalledWith('alice'),
    );
    await waitFor(() => expect(usersApi.getUser).toHaveBeenCalledWith(userId));
  });

  it('submits short queries without querying the API', () => {
    render(<AdminUser />);

    const input = screen.getByLabelText('Member username, email or ID');
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.submit(input.closest('form'));

    expect(usersApi.getUser).not.toHaveBeenCalled();
    expect(usersApi.searchUsers).not.toHaveBeenCalled();
  });

  it('loads an exact username match', async () => {
    usersApi.searchUsers.mockResolvedValueOnce([
      {
        _id: userId,
        displayName: 'Alice Example',
        email: 'alice@example.org',
        username: 'alice',
      },
    ]);
    usersApi.getUser.mockResolvedValueOnce(makeReportCard());

    render(<AdminUser />);

    submitMemberSearch('alice');

    await waitFor(() =>
      expect(usersApi.searchUsers).toHaveBeenCalledWith('alice'),
    );
    await waitFor(() => expect(usersApi.getUser).toHaveBeenCalledWith(userId));
    expect(
      await screen.findByRole('heading', {
        name: 'Alice Example report card',
      }),
    ).toBeInTheDocument();
  });

  it('loads an exact email match ignoring case', async () => {
    usersApi.searchUsers.mockResolvedValueOnce([
      {
        _id: userId,
        displayName: 'Alice Example',
        email: 'alice@example.org',
        username: 'alice',
      },
    ]);
    usersApi.getUser.mockResolvedValueOnce(makeReportCard());

    render(<AdminUser />);

    submitMemberSearch('ALICE@EXAMPLE.ORG');

    await waitFor(() =>
      expect(usersApi.searchUsers).toHaveBeenCalledWith('ALICE@EXAMPLE.ORG'),
    );
    await waitFor(() => expect(usersApi.getUser).toHaveBeenCalledWith(userId));
    expect(
      await screen.findByRole('heading', {
        name: 'Alice Example report card',
      }),
    ).toBeInTheDocument();
  });

  it('shows matching users when there is no exact match', async () => {
    usersApi.searchUsers.mockResolvedValueOnce([
      {
        _id: otherUserId,
        created: '2024-02-03T04:05:06.000Z',
        displayName: 'Alice Similar',
        email: 'similar@example.org',
        emailTemporary: 'pending@example.org',
        username: 'alice-similar',
      },
      {
        _id: '333333333333333333333333',
        created: '2021-07-06T00:00:00.000Z',
        displayName: 'Hot Daria Wants To Date https://bit.ly/lovezones Come In',
        email: 'spam@example.org',
        emailTemporary: 'spam@example.org',
        public: false,
        roles: ['user', 'suspended'],
        username: '24721768s',
      },
    ]);

    render(<AdminUser />);

    submitMemberSearch('alice');

    expect(
      await screen.findByText('alice-similar (Alice Similar)'),
    ).toHaveAttribute('href', `/admin/user?id=${otherUserId}`);
    expect(screen.getByText('alice-similar')).toBeInTheDocument();
    expect(screen.getByText(/similar@example\.org/)).toBeInTheDocument();
    expect(screen.getByText(/pending@example\.org/)).toBeInTheDocument();
    expect(screen.getByText('2024-02-03')).toBeInTheDocument();
    expect(screen.queryByText('ID')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Hot Daria Wants To Date/),
    ).not.toBeInTheDocument();
    expect(screen.getByText('1 likely spam hidden.')).toBeInTheDocument();
    expect(usersApi.getUser).not.toHaveBeenCalled();
  });

  it('reveals non-exact obvious spam matches when toggled off', async () => {
    usersApi.searchUsers.mockResolvedValueOnce([
      {
        _id: otherUserId,
        created: '2024-02-03T04:05:06.000Z',
        displayName: 'Alice Similar',
        email: 'similar@example.org',
        username: 'alice-similar',
      },
      {
        _id: '333333333333333333333333',
        created: '2021-07-06T00:00:00.000Z',
        displayName: 'Hot Daria Wants To Date https://bit.ly/lovezones Come In',
        email: 'spam@example.org',
        emailTemporary: 'spam@example.org',
        public: false,
        roles: ['user', 'suspended'],
        username: '24721768s',
      },
    ]);

    render(<AdminUser />);

    submitMemberSearch('alice');

    expect(
      await screen.findByText('alice-similar (Alice Similar)'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Hot Daria Wants To Date/),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Hide obvious spam'));

    expect(
      screen.getByText(
        '24721768s (Hot Daria Wants To Date https://bit.ly/lovezones Come In)',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('1 likely spam hidden.')).not.toBeInTheDocument();
    expect(usersApi.searchUsers).toHaveBeenCalledTimes(1);
  });

  it('loads an exact obvious spam match instead of hiding it', async () => {
    usersApi.searchUsers.mockResolvedValueOnce([
      {
        _id: userId,
        displayName: 'Hot Daria Wants To Date',
        email: 'spam@example.org',
        emailTemporary: 'spam@example.org',
        public: false,
        roles: ['user', 'suspended'],
        username: '24721768s',
      },
    ]);
    usersApi.getUser.mockResolvedValueOnce(
      makeReportCard({
        profile: {
          _id: userId,
          displayName: 'Hot Daria Wants To Date',
          email: 'spam@example.org',
          roles: ['user', 'suspended'],
          username: '24721768s',
        },
      }),
    );

    render(<AdminUser />);

    submitMemberSearch('24721768s');

    await waitFor(() =>
      expect(usersApi.searchUsers).toHaveBeenCalledWith('24721768s'),
    );
    await waitFor(() => expect(usersApi.getUser).toHaveBeenCalledWith(userId));
    expect(
      await screen.findByRole('heading', {
        name: 'Hot Daria Wants To Date report card',
      }),
    ).toBeInTheDocument();
  });

  it('shows an empty state when no users match', async () => {
    usersApi.searchUsers.mockResolvedValueOnce([]);

    render(<AdminUser />);

    submitMemberSearch('missing');

    expect(
      await screen.findByText('No matching members found.'),
    ).toBeInTheDocument();
  });

  it('renders report fallback data for dates, offers and contacts', async () => {
    usersApi.getUser.mockResolvedValueOnce(
      makeReportCard({
        contacts: [
          {
            _id: 'contact-older',
            created: '2024-01-01T00:00:00.000Z',
            userFrom: { _id: userId, username: 'alice' },
            userTo: { _id: otherUserId, username: 'bob' },
          },
          {
            _id: 'contact-newer',
            created: '2024-03-01T00:00:00.000Z',
            userFrom: { _id: '333333333333333333333333' },
            userTo: { _id: userId, username: 'alice' },
          },
          {
            _id: 'contact-fallback',
            created: '2024-02-01T00:00:00.000Z',
            user: { displayName: 'Fallback Contact' },
          },
          {
            _id: 'contact-from-only',
            created: '2024-04-01T00:00:00.000Z',
            userFrom: { _id: '444444444444444444444444' },
          },
          {
            _id: 'contact-to-only',
            created: '2024-05-01T00:00:00.000Z',
            userTo: { _id: '555555555555555555555555' },
          },
        ],
        offers: [
          {
            _id: 'offer-without-location',
            created: 'not-a-date',
            updated: null,
            type: 'meet',
          },
          {
            _id: 'offer-without-readable-data',
          },
        ],
        profile: {
          _id: userId,
          created: 'not-a-date',
          email: 'alice@example.org',
          location: {
            city: 'Helsinki',
            country: 'Finland',
          },
          public: true,
          roles: ['user'],
          seen: null,
          username: 'alice',
        },
        threadReferences: [],
      }),
    );

    render(<AdminUser />);

    submitMemberSearch(userId);

    await screen.findByRole('heading', { name: 'alice report card' });
    expect(
      screen.queryByRole('link', { name: 'Show location on map' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('row', { name: 'Type meet' })).toBeInTheDocument();
    expect(
      screen.getByRole('row', { name: 'Location Helsinki, Finland' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('row', { name: 'Profile visible Yes' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Thread votes')).not.toBeInTheDocument();
    expect(
      screen
        .getAllByRole('link', { name: 'Unknown member' })
        .map(link => link.getAttribute('href')),
    ).toEqual(
      [
        '555555555555555555555555',
        '444444444444444444444444',
        '333333333333333333333333',
      ].map(id => `/admin/user?id=${id}`),
    );
    expect(screen.getByText('Fallback Contact')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'bob' }),
    ).toHaveAttribute('href', `/admin/user?id=${otherUserId}`);
  });

  it('uses profile username and a non-id fallback for report headings and counts', async () => {
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

    submitMemberSearch(userId);

    expect(
      await screen.findByRole('heading', { name: 'alice report card' }),
    ).toBeInTheDocument();
    expect(screen.getByText('0 sent')).toBeInTheDocument();
    expect(screen.getByText('0 received')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '0 threads total' }),
    ).toHaveAttribute('href', `/admin/threads?userId=${userId}`);

    rerender(<AdminUser />);
    submitMemberSearch(userId);

    await waitFor(() => expect(usersApi.getUser).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByRole('heading', {
        name: 'Unknown member report card',
      }),
    ).toBeInTheDocument();
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

    submitMemberSearch(userId);

    await screen.findByRole('heading', { name: 'Alice Example report card' });
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

    submitMemberSearch(userId);

    await screen.findByRole('heading', { name: 'Alice Example report card' });
    fireEvent.click(screen.getByRole('button', { name: 'Suspend' }));

    expect(usersApi.setUserRole).not.toHaveBeenCalled();
  });
});
