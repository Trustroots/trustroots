import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminUser from '@/modules/admin/client/components/AdminUser.component';
import * as usersApi from '@/modules/admin/client/api/users.api';

jest.mock('@/modules/admin/client/api/users.api');
jest.mock('@/modules/users/client/components/ProfilePage.component', () => {
  const React = require('react');

  function MockProfilePage({ embedded, profileUsername, user }) {
    return React.createElement('div', {
      'data-testid': 'embedded-profile',
      'data-embedded': String(embedded),
      'data-profile-username': profileUsername,
      'data-viewer-id': user._id,
    });
  }

  MockProfilePage.propTypes = {
    embedded: () => null,
    profileUsername: () => null,
    user: () => null,
  };

  return { __esModule: true, default: MockProfilePage };
});
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

const userId = '111111111111111111111111';
const otherUserId = '222222222222222222222222';

afterEach(() => {
  jest.clearAllMocks();
  window.history.pushState({}, '', '/');
});

function confirmRoleChange(label) {
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: label }),
  );
}

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

const makeMemberList = (users, overrides = {}) => ({
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
    let resolveUser;
    usersApi.getUser.mockReturnValueOnce(
      new Promise(resolve => {
        resolveUser = resolve;
      }),
    );

    render(<AdminUser />);

    expect(screen.getByLabelText('Member username, email or ID')).toHaveValue(
      '',
    );
    expect(screen.getByText('Loading member...')).toBeInTheDocument();

    await act(async () => {
      resolveUser(
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
          profile: {
            _id: userId,
            displayName: 'Alice Example',
            email: 'alice@example.org',
            emailTemporary: 'alice-new@example.org',
            lastIpAddress: '203.0.113.10',
            roles: ['user'],
            username: 'alice',
          },
        }),
      );
    });
    expect(
      screen.queryByLabelText('Member username, email or ID'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Member report card' }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', {
        name: 'alice: Alice Example',
      }),
    ).toBeInTheDocument();
    expect(usersApi.getUser).toHaveBeenCalledWith(userId);
    expect(screen.getByText('State for alice')).toBeInTheDocument();
    expect(screen.queryByText('Role management')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Make greeter' }),
    ).toHaveAccessibleDescription(
      'Greeters can view acquisition stories and analysis, and see members who blocked their account.',
    );
    expect(
      screen.queryByText('Standard Trustroots member access.'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Hide obvious spam'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('3 sent')).toBeInTheDocument();
    expect(screen.getByText('4 received')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Public profile' }),
    ).toHaveAttribute('href', '/profile/alice');
    expect(screen.getByRole('link', { name: '203.0.113.10' })).toHaveAttribute(
      'href',
      '/admin/user?ip=203.0.113.10',
    );
    expect(screen.getByRole('link', { name: '203.0.113.10' })).toHaveAttribute(
      'target',
      '_self',
    );
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

  it('describes recognised and historical roles without adding edit controls', async () => {
    usersApi.getUser.mockResolvedValueOnce(
      makeReportCard({
        profile: {
          _id: userId,
          email: 'alice@example.org',
          roles: ['admin', 'moderator', 'shadowban', 'custom-legacy-role'],
          username: 'alice',
        },
      }),
    );

    window.history.pushState({}, '', `/admin/user?id=${userId}`);
    render(<AdminUser />);

    await screen.findByRole('heading', { name: 'alice' });
    expect(
      screen.getByText('admin', { selector: '.admin-user-roles li > span' }),
    ).toHaveAccessibleDescription(
      'Full access to administration and moderation tools.',
    );
    expect(
      screen.getByText('moderator', {
        selector: '.admin-user-roles li > span',
      }),
    ).toHaveAccessibleDescription(
      'Legacy moderation role retained for historical accounts.',
    );
    expect(
      screen.getByText('shadowban', {
        selector: '.admin-user-roles li > span',
      }),
    ).toHaveAccessibleDescription(
      'Member can use the site, but their profile and outreach are hidden from others.',
    );
    expect(
      screen.getByText('custom-legacy-role', {
        selector: '.admin-user-roles li > span',
      }),
    ).toHaveAccessibleDescription('Role stored on this member.');
    const roleHelp = screen.getByText('admin', {
      selector: '.admin-user-roles li > span',
    });
    expect(roleHelp).toHaveAttribute('tabindex', '0');
    fireEvent.focus(roleHelp);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Full access to administration and moderation tools.',
    );
    fireEvent.blur(roleHelp);
    expect(
      screen.queryByText('user', { selector: '.admin-user-roles li > span' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Standard Trustroots member access.'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /remove role/i }),
    ).not.toBeInTheDocument();
  });

  it('lists members with the selected current IP address from the URL', async () => {
    window.history.pushState({}, '', '/admin/user?ip=203.0.113.10');
    const matchingUser = {
      _id: userId,
      created: '2026-01-01T00:00:00.000Z',
      displayName: 'Alice Example',
      email: 'alice@example.org',
      lastIpAddress: '203.0.113.10',
      username: 'alice',
    };
    usersApi.listUsersByLastIpAddress
      .mockResolvedValueOnce(
        makeMemberList([matchingUser], {
          pagination: {
            page: 1,
            pageSize: 150,
            total: 151,
            totalPages: 2,
          },
        }),
      )
      .mockResolvedValueOnce(
        makeMemberList([matchingUser], {
          pagination: {
            page: 2,
            pageSize: 150,
            total: 151,
            totalPages: 2,
          },
        }),
      )
      .mockResolvedValueOnce(
        makeMemberList([matchingUser], {
          sort: { column: 'lastIpAddress', direction: 'ascending' },
        }),
      );

    render(<AdminUser />);

    expect(
      await screen.findByRole('link', { name: 'alice (Alice Example)' }),
    ).toBeInTheDocument();
    expect(usersApi.listUsersByLastIpAddress).toHaveBeenCalledWith(
      '203.0.113.10',
      {
        page: 1,
        sort: { column: 'username', direction: 'ascending' },
      },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      await screen.findByText('151 user(s). Page 2 of 2.'),
    ).toBeInTheDocument();
    expect(usersApi.listUsersByLastIpAddress).toHaveBeenCalledTimes(2);
    expect(usersApi.listUsersByLastIpAddress).toHaveBeenNthCalledWith(
      2,
      '203.0.113.10',
      {
        page: 2,
        sort: { column: 'username', direction: 'ascending' },
      },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Last IP' }));
    await waitFor(() =>
      expect(usersApi.listUsersByLastIpAddress).toHaveBeenCalledTimes(3),
    );
    expect(
      await screen.findByRole('button', { name: 'Last IP ▲' }),
    ).toBeInTheDocument();
    expect(usersApi.listUsersByLastIpAddress).toHaveBeenNthCalledWith(
      3,
      '203.0.113.10',
      {
        page: 1,
        sort: { column: 'lastIpAddress', direction: 'ascending' },
      },
    );
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
      await screen.findByRole('heading', { name: 'alice' }),
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
    expect(
      screen.getByRole('link', { name: 'Potential related accounts' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No potential related accounts found.'),
    ).toBeInTheDocument();
  });

  it('shows acquisition context and potential matches for a shadowbanned member', async () => {
    usersApi.getUser.mockResolvedValueOnce(
      makeReportCard({
        potentialMatches: [
          {
            _id: otherUserId,
            acquisitionStory: 'A fictional club introduced me.',
            displayName: 'Related Example',
            email: 'related@example.org',
            matchReasons: ['Email identifier', 'Acquisition story'],
            roles: ['user'],
            username: 'related',
          },
          {
            _id: '333333333333333333333333',
            acquisitionStory: '',
            displayName: '',
            email: 'username-lead@example.org',
            matchReasons: ['Username identifier'],
            roles: ['user', 'suspended'],
            username: 'username-lead',
          },
        ],
        profile: {
          _id: userId,
          acquisitionStory: 'A fictional club introduced me.',
          email: 'alice@example.org',
          roles: ['user', 'shadowban'],
          username: 'alice',
        },
      }),
    );

    window.history.pushState({}, '', `/admin/user?id=${userId}`);
    render(<AdminUser />);

    expect(
      await screen.findByRole('link', { name: 'Potential related accounts' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('row', {
        name: /Related Example.*related@example.org.*Email identifier, Acquisition story.*A fictional club introduced me/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Related Example' }),
    ).toHaveAttribute('href', `/admin/user/related`);
    expect(screen.getByRole('link', { name: 'username-lead' })).toHaveAttribute(
      'href',
      '/admin/user/username-lead',
    );
    expect(
      screen.getAllByRole('row', {
        name: /Acquisition story A fictional club introduced me/,
      }),
    ).toHaveLength(2);
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
    usersApi.searchUsers.mockResolvedValueOnce(
      makeMemberList([
        {
          _id: userId,
          username: 'alice',
        },
      ]),
    );
    usersApi.getUser.mockResolvedValueOnce(makeReportCard());

    render(<AdminUser />);

    expect(screen.getByLabelText('Member username, email or ID')).toHaveValue(
      'alice',
    );
    await waitFor(() =>
      expect(usersApi.searchUsers).toHaveBeenCalledWith('alice', {
        page: 1,
        sort: { column: 'username', direction: 'ascending' },
      }),
    );
    await waitFor(() => expect(usersApi.getUser).toHaveBeenCalledWith(userId));
  });

  it('loads a deep-link username exactly, independent of search pagination', async () => {
    window.history.pushState({}, '', '/admin/user/alex');
    usersApi.getUserByUsername.mockResolvedValueOnce(
      makeReportCard({
        profile: { _id: userId, roles: ['user'], username: 'alex' },
      }),
    );
    render(<AdminUser username="alex" />);
    await screen.findByRole('heading', { name: 'alex' });
    expect(usersApi.getUserByUsername).toHaveBeenCalledWith('alex');
    expect(usersApi.searchUsers).not.toHaveBeenCalled();
    expect(usersApi.getUser).not.toHaveBeenCalled();
    expect(
      screen.queryByLabelText('Member username, email or ID'),
    ).not.toBeInTheDocument();
  });

  it('embeds the reported username using the signed-in viewer', async () => {
    window.history.pushState({}, '', '/admin/user/alex');
    usersApi.getUserByUsername.mockResolvedValueOnce(
      makeReportCard({
        profile: { _id: userId, roles: ['user'], username: 'alex' },
      }),
    );
    render(
      <AdminUser
        username="alex"
        viewer={{ _id: 'admin-1', roles: ['admin'], public: true }}
      />,
    );

    const embeddedProfile = await screen.findByTestId('embedded-profile');
    expect(embeddedProfile).toHaveAttribute('data-profile-username', 'alex');
    expect(embeddedProfile).toHaveAttribute('data-viewer-id', 'admin-1');
    expect(embeddedProfile).toHaveAttribute('data-embedded', 'true');
    expect(screen.getByRole('heading', { name: 'alex' })).toBeInTheDocument();
  });

  it('shows the no-match state when a deep-link username does not exist', async () => {
    window.history.pushState({}, '', '/admin/user/missing-member');
    usersApi.getUserByUsername.mockRejectedValueOnce(new Error('Not found'));

    render(<AdminUser username="missing-member" />);

    expect(
      await screen.findByText('No matching members found.'),
    ).toBeInTheDocument();
    expect(usersApi.searchUsers).not.toHaveBeenCalled();
    expect(screen.queryByText('Loading member...')).not.toBeInTheDocument();
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
    usersApi.searchUsers.mockResolvedValueOnce(
      makeMemberList([
        {
          _id: userId,
          displayName: 'Alice Example',
          email: 'alice@example.org',
          username: 'alice',
        },
      ]),
    );
    usersApi.getUser.mockResolvedValueOnce(makeReportCard());

    render(<AdminUser />);

    submitMemberSearch('alice');

    await waitFor(() =>
      expect(usersApi.searchUsers).toHaveBeenCalledWith('alice', {
        page: 1,
        sort: { column: 'username', direction: 'ascending' },
      }),
    );
    await waitFor(() => expect(usersApi.getUser).toHaveBeenCalledWith(userId));
    expect(
      await screen.findByRole('heading', {
        name: 'alice: Alice Example',
      }),
    ).toBeInTheDocument();
  });

  it('loads an exact email match ignoring case', async () => {
    usersApi.searchUsers.mockResolvedValueOnce(
      makeMemberList([
        {
          _id: userId,
          displayName: 'Alice Example',
          email: 'alice@example.org',
          username: 'alice',
        },
      ]),
    );
    usersApi.getUser.mockResolvedValueOnce(makeReportCard());

    render(<AdminUser />);

    submitMemberSearch('ALICE@EXAMPLE.ORG');

    await waitFor(() =>
      expect(usersApi.searchUsers).toHaveBeenCalledWith('ALICE@EXAMPLE.ORG', {
        page: 1,
        sort: { column: 'username', direction: 'ascending' },
      }),
    );
    await waitFor(() => expect(usersApi.getUser).toHaveBeenCalledWith(userId));
    expect(
      await screen.findByRole('heading', {
        name: 'alice: Alice Example',
      }),
    ).toBeInTheDocument();
  });

  it('shows matching users when there is no exact match', async () => {
    usersApi.searchUsers.mockResolvedValueOnce(
      makeMemberList([
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
          displayName:
            'Hot Daria Wants To Date https://bit.ly/lovezones Come In',
          email: 'spam@example.org',
          emailTemporary: 'spam@example.org',
          public: false,
          roles: ['user', 'suspended'],
          username: '24721768s',
        },
      ]),
    );

    render(<AdminUser />);

    submitMemberSearch('alice');

    expect(
      await screen.findByText('alice-similar (Alice Similar)'),
    ).toHaveAttribute('href', `/admin/user/alice-similar`);
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

  it('paginates and server-sorts non-exact member matches', async () => {
    const matchingUser = {
      _id: otherUserId,
      created: '2024-02-03T04:05:06.000Z',
      displayName: 'Alice Similar',
      email: 'similar@example.org',
      username: 'alice-similar',
    };
    usersApi.searchUsers
      .mockResolvedValueOnce(
        makeMemberList([matchingUser], {
          pagination: {
            page: 1,
            pageSize: 150,
            total: 151,
            totalPages: 2,
          },
        }),
      )
      .mockResolvedValueOnce(
        makeMemberList([matchingUser], {
          pagination: {
            page: 2,
            pageSize: 150,
            total: 151,
            totalPages: 2,
          },
        }),
      )
      .mockResolvedValueOnce(
        makeMemberList([matchingUser], {
          sort: { column: 'email', direction: 'ascending' },
        }),
      );

    render(<AdminUser />);
    submitMemberSearch('alice similar');
    expect(
      await screen.findByRole('link', {
        name: 'alice-similar (Alice Similar)',
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      await screen.findByText('151 user(s). Page 2 of 2.'),
    ).toBeInTheDocument();
    expect(usersApi.searchUsers).toHaveBeenCalledTimes(2);
    expect(usersApi.searchUsers).toHaveBeenNthCalledWith(2, 'alice similar', {
      page: 2,
      sort: { column: 'username', direction: 'ascending' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Email' }));
    await waitFor(() => expect(usersApi.searchUsers).toHaveBeenCalledTimes(3));
    expect(
      await screen.findByRole('button', { name: 'Email ▲' }),
    ).toBeInTheDocument();
    expect(usersApi.searchUsers).toHaveBeenNthCalledWith(3, 'alice similar', {
      page: 1,
      sort: { column: 'email', direction: 'ascending' },
    });
  });

  it('reveals non-exact obvious spam matches when toggled off', async () => {
    usersApi.searchUsers.mockResolvedValueOnce(
      makeMemberList([
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
          displayName:
            'Hot Daria Wants To Date https://bit.ly/lovezones Come In',
          email: 'spam@example.org',
          emailTemporary: 'spam@example.org',
          public: false,
          roles: ['user', 'suspended'],
          username: '24721768s',
        },
      ]),
    );

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
      await screen.findByText(
        '24721768s (Hot Daria Wants To Date https://bit.ly/lovezones Come In)',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('1 likely spam hidden.')).not.toBeInTheDocument();
    expect(usersApi.searchUsers).toHaveBeenCalledTimes(1);
  });

  it('loads an exact obvious spam match instead of hiding it', async () => {
    usersApi.searchUsers.mockResolvedValueOnce(
      makeMemberList([
        {
          _id: userId,
          displayName: 'Hot Daria Wants To Date',
          email: 'spam@example.org',
          emailTemporary: 'spam@example.org',
          public: false,
          roles: ['user', 'suspended'],
          username: '24721768s',
        },
      ]),
    );
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
      expect(usersApi.searchUsers).toHaveBeenCalledWith('24721768s', {
        page: 1,
        sort: { column: 'username', direction: 'ascending' },
      }),
    );
    await waitFor(() => expect(usersApi.getUser).toHaveBeenCalledWith(userId));
    expect(
      await screen.findByRole('heading', {
        name: '24721768s: Hot Daria Wants To Date',
      }),
    ).toBeInTheDocument();
  });

  it('shows an empty state when no users match', async () => {
    usersApi.searchUsers.mockResolvedValueOnce(makeMemberList([]));

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
          {
            _id: 'contact-without-date',
            user: { displayName: 'Undated Contact' },
          },
          {
            _id: 'contact-without-date-2',
            user: { displayName: 'Another Undated Contact' },
          },
          {
            _id: 'contact-string-user-ids',
            created: '2024-06-01T00:00:00.000Z',
            userFrom: userId,
            userTo: { _id: '666666666666666666666666' },
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

    await screen.findByRole('heading', { name: 'alice' });
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
        '666666666666666666666666',
        '555555555555555555555555',
        '444444444444444444444444',
        '333333333333333333333333',
      ].map(id => `/admin/user?id=${id}`),
    );
    expect(screen.getByText('Fallback Contact')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'bob' })).toHaveAttribute(
      'href',
      `/admin/user/bob`,
    );
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

    const { unmount } = render(<AdminUser />);

    submitMemberSearch(userId);

    expect(
      await screen.findByRole('heading', { name: 'alice' }),
    ).toBeInTheDocument();
    expect(screen.getByText('0 sent')).toBeInTheDocument();
    expect(screen.getByText('0 received')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '0 threads total' }),
    ).toHaveAttribute('href', `/admin/threads?userId=${userId}`);

    unmount();
    window.history.pushState({}, '', '/');
    render(<AdminUser />);
    submitMemberSearch(userId);

    await waitFor(() => expect(usersApi.getUser).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByRole('heading', {
        name: 'Unknown member',
      }),
    ).toBeInTheDocument();
  });

  it('changes a member role after confirmation and refreshes the profile', async () => {
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

    await screen.findByRole('heading', { name: 'alice: Alice Example' });
    expect(
      screen.queryByRole('button', { name: 'Unshadowban' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Suspend' }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Suspend alice?');
    confirmRoleChange('Suspend');
    await waitFor(() =>
      expect(usersApi.setUserRole).toHaveBeenCalledWith(userId, 'suspended'),
    );
    await waitFor(() => expect(usersApi.getUser).toHaveBeenCalledTimes(2));
  });

  it.each(['add', 'remove'])('can %s greeter status', async action => {
    const roles = action === 'remove' ? ['user', 'welcome-team'] : ['user'];
    usersApi.getUser.mockResolvedValue(
      makeReportCard({ profile: { _id: userId, username: 'river', roles } }),
    );
    usersApi.setUserRole.mockResolvedValue({});
    render(<AdminUser />);
    submitMemberSearch(userId);
    const label = action === 'remove' ? 'Remove greeter' : 'Make greeter';
    fireEvent.click(await screen.findByRole('button', { name: label }));
    confirmRoleChange(label);
    await waitFor(() =>
      expect(usersApi.setUserRole).toHaveBeenCalledWith(
        userId,
        'welcome-team',
        action,
      ),
    );
    await waitFor(() => expect(usersApi.getUser).toHaveBeenCalledTimes(2));
  });

  it.each([
    ['user', 'shadowban'],
    ['user', 'suspended', 'shadowban'],
  ])(
    'replaces Shadow ban with Unshadowban and refreshes the member report (%s)',
    async (...roles) => {
      const shadowbanned = makeReportCard({
        profile: { _id: userId, username: 'river', roles },
      });
      const restored = makeReportCard({
        profile: {
          _id: userId,
          username: 'river',
          roles: roles.filter(role => role !== 'shadowban'),
        },
      });
      usersApi.getUser
        .mockResolvedValueOnce(shadowbanned)
        .mockResolvedValueOnce(restored);
      usersApi.setUserRole.mockResolvedValueOnce({});
      render(<AdminUser />);
      submitMemberSearch(userId);

      const unshadowban = await screen.findByRole('button', {
        name: 'Unshadowban',
      });
      expect(
        screen.queryByRole('button', { name: 'Shadow ban' }),
      ).not.toBeInTheDocument();
      expect(unshadowban.previousElementSibling).toHaveTextContent('Suspend');
      fireEvent.click(unshadowban);
      expect(screen.getByRole('dialog')).toHaveTextContent(
        'Past hidden messages will stay hidden.',
      );
      confirmRoleChange('Unshadowban');
      await waitFor(() =>
        expect(usersApi.setUserRole).toHaveBeenCalledWith(
          userId,
          'shadowban',
          'remove',
        ),
      );
      await waitFor(() => expect(usersApi.getUser).toHaveBeenCalledTimes(2));
      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: 'Unshadowban' }),
        ).not.toBeInTheDocument(),
      );
    },
  );

  it('keeps a shadowban when its confirmation is declined', async () => {
    usersApi.getUser.mockResolvedValueOnce(
      makeReportCard({
        profile: {
          _id: userId,
          username: 'river',
          roles: ['user', 'shadowban'],
        },
      }),
    );
    render(<AdminUser />);
    submitMemberSearch(userId);

    fireEvent.click(await screen.findByRole('button', { name: 'Unshadowban' }));
    confirmRoleChange('Cancel');
    expect(usersApi.setUserRole).not.toHaveBeenCalled();
  });

  it('reports failed unshadowbanning and re-enables the action', async () => {
    usersApi.getUser.mockResolvedValueOnce(
      makeReportCard({
        profile: {
          _id: userId,
          username: 'river',
          roles: ['user', 'shadowban'],
        },
      }),
    );
    usersApi.setUserRole.mockRejectedValueOnce(new Error('Unavailable'));
    render(<AdminUser />);
    submitMemberSearch(userId);

    fireEvent.click(await screen.findByRole('button', { name: 'Unshadowban' }));
    confirmRoleChange('Unshadowban');
    expect(
      await screen.findByText('Could not change the role. Please try again.'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Unshadowban',
      }),
    ).toBeEnabled();
  });

  it('shows failed role changes and re-enables the control', async () => {
    usersApi.getUser.mockResolvedValue(
      makeReportCard({
        profile: { _id: userId, username: 'river', roles: ['user'] },
      }),
    );
    usersApi.setUserRole.mockRejectedValueOnce(new Error('Unavailable'));
    render(<AdminUser />);
    submitMemberSearch(userId);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Make greeter' }),
    );
    confirmRoleChange('Make greeter');
    expect(
      await screen.findByText('Could not change the role. Please try again.'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Make greeter',
      }),
    ).toBeEnabled();
  });

  it('reports a refresh failure without offering to repeat a successful change', async () => {
    usersApi.getUser
      .mockResolvedValueOnce(
        makeReportCard({
          profile: { _id: userId, username: 'river', roles: ['user'] },
        }),
      )
      .mockRejectedValueOnce(new Error('Unavailable'));
    usersApi.setUserRole.mockResolvedValueOnce({});
    render(<AdminUser />);
    submitMemberSearch(userId);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Make greeter' }),
    );
    confirmRoleChange('Make greeter');

    expect(
      await screen.findByText(
        'The role was updated, but member details could not be refreshed. Close this dialog and reload the report.',
      ),
    ).toBeInTheDocument();
    confirmRoleChange('Close');
    expect(usersApi.setUserRole).toHaveBeenCalledTimes(1);
  });

  it('keeps focus in the dialog and lets Escape cancel before submission', async () => {
    usersApi.getUser.mockResolvedValueOnce(
      makeReportCard({
        profile: { _id: userId, username: 'river', roles: ['user'] },
      }),
    );
    render(<AdminUser />);
    submitMemberSearch(userId);

    fireEvent.click(await screen.findByRole('button', { name: 'Shadow ban' }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(dialog).toContainElement(document.activeElement),
    );

    fireEvent.keyDown(document, { key: 'Escape', keyCode: 27 });
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(usersApi.setUserRole).not.toHaveBeenCalled();
  });

  it('uses a neutral prompt when a profile has no username', async () => {
    usersApi.getUser.mockResolvedValueOnce(
      makeReportCard({ profile: { _id: userId, roles: ['user'] } }),
    );
    render(<AdminUser />);
    submitMemberSearch(userId);
    fireEvent.click(await screen.findByRole('button', { name: 'Suspend' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Suspend this member?',
    );
  });

  it('announces progress and prevents cancelling while a role change is pending', async () => {
    let finishRoleChange;
    usersApi.getUser.mockResolvedValue(
      makeReportCard({
        profile: { _id: userId, username: 'river', roles: ['user'] },
      }),
    );
    usersApi.setUserRole.mockReturnValue(
      new Promise(resolve => {
        finishRoleChange = resolve;
      }),
    );
    const componentRef = React.createRef();
    render(<AdminUser ref={componentRef} />);
    submitMemberSearch(userId);

    fireEvent.click(await screen.findByRole('button', { name: 'Suspend' }));
    confirmRoleChange('Suspend');

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'Updating role…',
    );
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    ).toBeDisabled();
    const updateButton = within(dialog).getByRole('button', {
      name: 'Updating…',
    });
    updateButton.removeAttribute('disabled');
    fireEvent.click(updateButton);
    componentRef.current.confirmUserRoleChange();
    componentRef.current.cancelUserRoleChange();
    expect(usersApi.setUserRole).toHaveBeenCalledTimes(1);
    finishRoleChange({});
    await waitFor(() => expect(usersApi.getUser).toHaveBeenCalledTimes(2));
  });

  it('does not change roles when confirmation is declined', async () => {
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

    await screen.findByRole('heading', { name: 'alice: Alice Example' });
    fireEvent.click(screen.getByRole('button', { name: 'Suspend' }));

    confirmRoleChange('Cancel');
    expect(usersApi.setUserRole).not.toHaveBeenCalled();
  });

  it.each([
    ['Suspend', ['user']],
    ['Shadow ban', ['user']],
    ['Make volunteer', ['user']],
    ['Make volunteer alumni', ['user']],
    ['Make greeter', ['user']],
    ['Remove greeter', ['user', 'welcome-team']],
    ['Unshadowban', ['user', 'shadowban']],
  ])(
    'does not apply %s when its confirmation is declined',
    async (label, roles) => {
      usersApi.getUser.mockResolvedValueOnce(
        makeReportCard({
          profile: { _id: userId, username: 'river', roles },
        }),
      );

      render(<AdminUser />);
      submitMemberSearch(userId);
      fireEvent.click(await screen.findByRole('button', { name: label }));

      expect(screen.getByRole('dialog')).toBeVisible();
      confirmRoleChange('Cancel');
      expect(usersApi.setUserRole).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['Shadow ban', 'shadowban'],
    ['Make volunteer', 'volunteer'],
    ['Make volunteer alumni', 'volunteer-alumni'],
  ])('applies %s after confirmation', async (label, role) => {
    usersApi.getUser.mockResolvedValue(
      makeReportCard({
        profile: { _id: userId, username: 'river', roles: ['user'] },
      }),
    );
    usersApi.setUserRole.mockResolvedValueOnce({});

    render(<AdminUser />);
    submitMemberSearch(userId);
    fireEvent.click(await screen.findByRole('button', { name: label }));

    const prompt =
      role === 'shadowban'
        ? 'Shadow ban river?'
        : `Set river's role to ${role}?`;
    expect(screen.getByRole('dialog')).toHaveTextContent(prompt);
    confirmRoleChange(
      role === 'shadowban' ? 'Shadow ban' : 'Confirm role change',
    );
    await waitFor(() =>
      expect(usersApi.setUserRole).toHaveBeenCalledWith(userId, role),
    );
  });
});
