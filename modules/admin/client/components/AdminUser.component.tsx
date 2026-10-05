// External dependencies
import get from 'lodash/get';
import { formatRoleLabel } from '../utils/role-label';
import { getAdminUserHref } from '../utils/member-url';
import PropTypes from 'prop-types';
import React, { Component, type ChangeEvent, type FormEvent } from 'react';
import { Modal } from 'react-bootstrap';

// Internal dependencies
import {
  getUser,
  getUserByUsername as getUserRecordByUsername,
  listUsersByLastIpAddress,
  searchUsers,
  setUserRole,
} from '../api/users.api';
import AdminHeader from './AdminHeader.component';
import AdminNotes from './AdminNotes';
import AdminReferenceVoteItem from './AdminReferenceVoteItem.component';
import AdminUserResultsTable from './AdminUserResultsTable.component';
import Json from './Json.component';
import UserEmailConfirmLink from './UserEmailConfirmLink.component';
import UserState from './UserState.component';
import Tooltip from '@/modules/core/client/components/Tooltip';
import ProfilePage from '@/modules/users/client/components/ProfilePage.component';
import type { AuthUser } from '@/modules/core/client/react-app/auth';
import type { UserProfile } from '@/modules/users/client/types';
import {
  SEARCH_STRING_LIMIT,
  getReferenceUserId,
  isExactUserMatch,
  isMongoObjectId,
  isObviousSpamUser,
  normalizeAdminQuery,
  isSuspendedUser,
} from './userSearch.helpers';

interface MemberSort {
  column: string;
  direction: 'ascending' | 'descending';
}

interface MemberProfile {
  _id: string;
  username?: string;
  displayName?: string;
  email?: string;
  emailTemporary?: string;
  acquisitionStory?: string;
  roles: string[];
  public?: boolean;
  created?: string | number;
  seen?: string | number;
  lastIpAddress?: string;
  location?: { city?: string; country?: string };
}

interface MemberThreadReference {
  _id: string;
  created: string | number;
  reference: string;
  userFrom?: string | { _id: string };
  userTo?: string | { _id: string };
  from?: MemberProfile;
  to?: MemberProfile;
  message?: string;
}

interface MemberContactUser {
  _id: string;
  username?: string;
  displayName?: string;
}

interface MemberContact {
  _id: string;
  userFrom?: string | MemberContactUser;
  userTo?: string | MemberContactUser;
  user?: string | MemberContactUser;
  created?: string | number;
}

const DEFAULT_MEMBER_LIST_SORT: MemberSort = {
  column: 'username',
  direction: 'ascending',
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  'welcome-team':
    'Greeters can view acquisition stories and analysis, and see members who blocked their account.',
  admin: 'Full access to administration and moderation tools.',
  moderator: 'Legacy moderation role retained for historical accounts.',
  shadowban:
    'Member can use the site, but their profile and outreach are hidden from others.',
  suspended: 'Member access is blocked until an administrator intervenes.',
  volunteer: 'Current Trustroots volunteer.',
  'volunteer-alumni': 'Former Trustroots volunteer.',
};

interface MemberRecord {
  _id: string;
  profile: MemberProfile;
  potentialMatches?: Array<{
    _id: string;
    username: string;
    displayName?: string;
    email?: string;
    roles: string[];
    matchReasons: string[];
    acquisitionStory?: string;
  }>;
  threadReferences?: MemberThreadReference[];
  contacts: MemberContact[];
  offers: Array<{
    _id: string;
    title?: string;
    location?: string[];
    type?: string;
    status?: string;
    description?: string;
    created?: string | number;
    updated?: string | number;
  }>;
  threadCount?: number;
  threadReferencesReceivedYes?: number;
  threadReferencesReceivedNo?: number;
  threadReferencesSentYes?: number;
  threadReferencesSentNo?: number;
  messageFromCount?: number;
  messageToCount?: number;
}

interface MemberList {
  users: MemberRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  } | null;
  sort: MemberSort;
}

interface AdminUserState {
  hasSearched: boolean;
  hideObviousSpamUsers: boolean;
  isSettingUserRole: boolean;
  isSearching: boolean;
  notesRevision: number;
  matchingUsersIpAddress: string | null;
  matchingUsersPagination: MemberList['pagination'];
  matchingUsersSort: MemberSort;
  matchingUsersSource: 'ip' | 'search' | null;
  matchingUsers: MemberRecord[];
  query: string;
  user: MemberRecord | false;
  roleChangeError?: 'change' | 'refresh' | false;
  roleChangeSucceeded: boolean;
  pendingRoleChange: {
    role: string;
    action?: 'add' | 'remove';
  } | null;
}

interface InfoTableProps {
  rows: Array<[string, React.ReactNode | null | undefined]>;
}

function formatDate(value?: string | number | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function formatLocation(location?: string[] | null) {
  if (!Array.isArray(location) || location.length < 2) {
    return null;
  }

  return `${location[1]}, ${location[0]}`;
}

function formatLocationForSearch(location?: string[] | null) {
  if (!Array.isArray(location) || location.length < 2) {
    return null;
  }

  return `${location[1]},${location[0]}`;
}

function getRoleChangeConfirmation(
  role: string,
  action: 'add' | 'remove' | undefined,
  username: string,
) {
  if (role === 'shadowban' && action === 'remove') {
    return {
      title: `Unshadowban ${username}?`,
      message: 'Past hidden messages will stay hidden.',
      confirmLabel: 'Unshadowban',
    };
  }
  if (role === 'suspended' && action !== 'remove') {
    return {
      title: `Suspend ${username}?`,
      message:
        'This will block their access until an administrator intervenes.',
      confirmLabel: 'Suspend',
    };
  }
  if (role === 'shadowban' && action !== 'remove') {
    return {
      title: `Shadow ban ${username}?`,
      message: 'Their profile and outreach will be hidden from others.',
      confirmLabel: 'Shadow ban',
    };
  }
  if (role === 'welcome-team') {
    return action === 'remove'
      ? {
          title: `Remove ${username} as a greeter?`,
          message: '',
          confirmLabel: 'Remove greeter',
        }
      : {
          title: `Make ${username} a greeter?`,
          message: ROLE_DESCRIPTIONS['welcome-team'],
          confirmLabel: 'Make greeter',
        };
  }
  return {
    title: `Set ${username}'s role to ${role}?`,
    message: '',
    confirmLabel: 'Confirm role change',
  };
}

function getUserId(user: MemberContact['userFrom']): string | undefined {
  return typeof user === 'string' ? user : user?._id;
}

function getContactOtherMember(contact: MemberContact, currentUserId: string) {
  const userFrom = get(contact, ['userFrom']);
  const userTo = get(contact, ['userTo']);

  if (getUserId(userFrom) === currentUserId) {
    return userTo;
  }

  if (getUserId(userTo) === currentUserId) {
    return userFrom;
  }

  return get(contact, ['user']) || userTo || userFrom;
}

function newestFirstByCreated(
  first: { created?: string | number },
  second: { created?: string | number },
) {
  return (
    new Date(second.created || 0).getTime() -
    new Date(first.created || 0).getTime()
  );
}

function InfoTable({ rows }: InfoTableProps) {
  const visibleRows = rows.filter(([, value]) => value);

  if (!visibleRows.length) {
    return null;
  }

  return (
    <table className="table table-condensed admin-readable-table">
      <tbody>
        {visibleRows.map(([label, value]) => (
          <tr key={label}>
            <th>{label}</th>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

InfoTable.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.array).isRequired,
};

export default class AdminUser extends Component<
  { username?: string; viewer?: AuthUser | null },
  AdminUserState
> {
  constructor(props: { username?: string }) {
    super(props);
    this.getUserById = this.getUserById.bind(this);
    this.getUsersByLastIpAddress = this.getUsersByLastIpAddress.bind(this);
    this.handleUserRoleChange = this.handleUserRoleChange.bind(this);
    this.cancelUserRoleChange = this.cancelUserRoleChange.bind(this);
    this.confirmUserRoleChange = this.confirmUserRoleChange.bind(this);
    this.onHideObviousSpamUsersChange =
      this.onHideObviousSpamUsersChange.bind(this);
    this.onMatchingUsersPageChange = this.onMatchingUsersPageChange.bind(this);
    this.onMatchingUsersSortChange = this.onMatchingUsersSortChange.bind(this);
    this.onQueryChange = this.onQueryChange.bind(this);
    this.queryUser = this.queryUser.bind(this);
    this.state = {
      hasSearched: false,
      hideObviousSpamUsers: true,
      isSettingUserRole: false,
      isSearching: false,
      notesRevision: 0,
      matchingUsersIpAddress: null,
      matchingUsersPagination: null,
      matchingUsersSort: DEFAULT_MEMBER_LIST_SORT,
      matchingUsersSource: null,
      matchingUsers: [],
      query: '',
      user: false,
      pendingRoleChange: null,
      roleChangeSucceeded: false,
    };
  }

  componentDidMount() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const ipAddress = urlParams.get('ip');
    const query = urlParams.get('q');

    if (this.props.username) {
      this.setState({ query: this.props.username }, () =>
        this.getUserByUsername(this.props.username as string),
      );
    } else if (id && isMongoObjectId(id)) {
      this.getUserById(id);
    } else if (ipAddress) {
      this.getUsersByLastIpAddress(ipAddress);
    } else if (query) {
      this.setState({ query }, () => this.queryUser(null));
    }
  }

  onQueryChange(event: ChangeEvent<HTMLInputElement>) {
    const query = event.target.value;
    const normalizedQuery = normalizeAdminQuery(query);
    this.setState({ query });

    // Update URL
    const url = new URL(document.location.href);
    url.pathname = '/admin/user';
    url.searchParams.delete('id');
    url.searchParams.delete('ip');
    url.searchParams.delete('q');
    if (query) {
      if (isMongoObjectId(normalizedQuery)) {
        url.searchParams.set('id', normalizedQuery);
      } else {
        url.searchParams.set('q', query);
      }
    }
    window.history.pushState({ query }, window.document.title, url.toString());
  }

  onHideObviousSpamUsersChange(event: ChangeEvent<HTMLInputElement>) {
    this.setState({ hideObviousSpamUsers: event.target.checked });
  }

  onMatchingUsersPageChange(page: number) {
    if (this.state.matchingUsersSource === 'ip') {
      return this.getUsersByLastIpAddress(this.state.matchingUsersIpAddress, {
        page,
      });
    }
    return this.queryUser(null, { page });
  }

  onMatchingUsersSortChange(sort: MemberSort) {
    this.setState({ matchingUsersSort: sort }, () => {
      if (this.state.matchingUsersSource === 'ip') {
        this.getUsersByLastIpAddress(this.state.matchingUsersIpAddress, {
          page: 1,
          sort,
        });
      } else {
        this.queryUser(null, { page: 1, sort });
      }
    });
  }

  handleUserRoleChange(role: string, action?: 'add' | 'remove') {
    if (get(this, ['state', 'user', 'profile', '_id'])) {
      this.setState({
        pendingRoleChange: { role, action },
        roleChangeError: false,
        roleChangeSucceeded: false,
      });
    }
  }

  cancelUserRoleChange() {
    if (!this.state.isSettingUserRole) {
      this.setState({
        pendingRoleChange: null,
        roleChangeError: false,
        roleChangeSucceeded: false,
      });
    }
  }

  confirmUserRoleChange() {
    const id = get(this, ['state', 'user', 'profile', '_id']);
    const pendingRoleChange = this.state.pendingRoleChange;
    if (!id || !pendingRoleChange || this.state.isSettingUserRole) {
      return;
    }
    if (this.state.roleChangeSucceeded) {
      this.cancelUserRoleChange();
      return;
    }

    this.setState(
      { isSettingUserRole: true, roleChangeError: false },
      async () => {
        try {
          if (pendingRoleChange.action) {
            await setUserRole(
              id,
              pendingRoleChange.role,
              pendingRoleChange.action,
            );
          } else {
            await setUserRole(id, pendingRoleChange.role);
          }
          this.setState(({ notesRevision }) => ({
            notesRevision: notesRevision + 1,
            roleChangeSucceeded: true,
          }));
          try {
            const user = await getUser(id);
            this.setState({ user, pendingRoleChange: null });
          } catch {
            this.setState({ roleChangeError: 'refresh' });
          }
        } catch {
          this.setState({ roleChangeError: 'change' });
        } finally {
          this.setState({ isSettingUserRole: false });
        }
      },
    );
  }

  queryUser(
    event: FormEvent<HTMLFormElement> | null,
    options: { page?: number; sort?: MemberSort } = {},
  ) {
    if (event) {
      event.preventDefault();
    }
    const query = normalizeAdminQuery(this.state.query);
    if (query.length < SEARCH_STRING_LIMIT) {
      return;
    }

    if (isMongoObjectId(query)) {
      this.getUserById(query);
      return;
    }
    const requestedSort = options.sort || this.state.matchingUsersSort;

    this.setState(
      { hasSearched: true, isSearching: true, matchingUsers: [], user: false },
      async () => {
        const memberList: MemberList = await searchUsers(query, {
          page: options.page || 1,
          sort: requestedSort,
        });
        const exactMatch = memberList.users.find(user =>
          isExactUserMatch(query, user),
        );

        if (exactMatch) {
          this.getUserById(exactMatch._id);
          return;
        }

        this.setState({
          isSearching: false,
          matchingUsers: memberList.users,
          matchingUsersPagination: memberList.pagination,
          matchingUsersSort: memberList.sort,
          matchingUsersSource: 'search',
        });
      },
    );
  }

  getUserById(id: string) {
    this.setState(
      { hasSearched: true, isSearching: true, matchingUsers: [], user: false },
      async () => {
        if (isMongoObjectId(id)) {
          const user: MemberRecord | false = await getUser(id);
          this.setState({ isSearching: false, user });
        }
      },
    );
  }

  getUserByUsername(username: string) {
    this.setState(
      { hasSearched: true, isSearching: true, matchingUsers: [], user: false },
      async () => {
        try {
          const user: MemberRecord | false = await getUserRecordByUsername(
            username,
          );
          this.setState({ isSearching: false, user });
        } catch {
          this.setState({ isSearching: false, user: false });
        }
      },
    );
  }

  getUsersByLastIpAddress(
    ipAddress: string | null,
    options: { page?: number; sort?: MemberSort } = {},
  ) {
    const requestedSort = options.sort || this.state.matchingUsersSort;
    this.setState(
      { hasSearched: true, isSearching: true, matchingUsers: [], user: false },
      async () => {
        const memberList: MemberList = await listUsersByLastIpAddress(
          ipAddress,
          {
            page: options.page || 1,
            sort: requestedSort,
          },
        );
        this.setState({
          isSearching: false,
          matchingUsers: memberList.users,
          matchingUsersIpAddress: ipAddress,
          matchingUsersPagination: memberList.pagination,
          matchingUsersSort: memberList.sort,
          matchingUsersSource: 'ip',
        });
      },
    );
  }

  hasRole(role: string) {
    return get(this.state.user, ['profile', 'roles'], []).includes(role);
  }

  render() {
    const {
      hasSearched,
      hideObviousSpamUsers,
      isSearching,
      isSettingUserRole,
      pendingRoleChange,
      matchingUsers,
      matchingUsersPagination,
      matchingUsersSort,
      query,
      roleChangeError,
      roleChangeSucceeded,
      user,
    } = this.state;
    const isProfile = user && user.profile;
    const isSuspended = isSuspendedUser(get(user, ['profile']));
    const isShadowbanned = this.hasRole('shadowban');
    const isRestricted = get(user, ['profile', 'roles'], []).some(
      (role: string) => ['shadowban', 'suspended'].includes(role),
    );
    const potentialMatches = user ? user.potentialMatches || [] : [];
    const visibleMatchingUsers = hideObviousSpamUsers
      ? matchingUsers.filter(user => !isObviousSpamUser(user))
      : matchingUsers;
    const hiddenObviousSpamUserCount =
      matchingUsers.length - visibleMatchingUsers.length;
    const hasNoMatchingUsers =
      hasSearched && !isSearching && visibleMatchingUsers.length === 0;
    const userId = get(user, ['profile', '_id']);
    const profileLabel = isProfile
      ? [user.profile.username, user.profile.displayName]
          .filter(Boolean)
          .join(': ') || 'Unknown member'
      : '';
    const profileRows: InfoTableProps['rows'] = isProfile
      ? ([
          ['Display name', user.profile.displayName],
          [
            'Username',
            user.profile.username && (
              <a href={`/profile/${user.profile.username}`}>
                {user.profile.username}
              </a>
            ),
          ],
          [
            'Public profile',
            user.profile.username && (
              <a href={`/profile/${user.profile.username}`}>
                /profile/{user.profile.username}
              </a>
            ),
          ],
          ['Email', user.profile.email],
          ['Temporary email', user.profile.emailTemporary],
          ['Acquisition story', user.profile.acquisitionStory],
          [
            'Roles',
            user.profile.roles && user.profile.roles.length
              ? user.profile.roles.map(formatRoleLabel).join(', ')
              : null,
          ],
          ['Profile visible', user.profile.public ? 'Yes' : 'No'],
          ['Signed up', formatDate(user.profile.created)],
          ['Last seen', formatDate(user.profile.seen)],
          [
            'Last IP address',
            user.profile.lastIpAddress && (
              <a
                href={`/admin/user?ip=${user.profile.lastIpAddress}`}
                target="_self"
              >
                {user.profile.lastIpAddress}
              </a>
            ),
          ],
          [
            'Location',
            user.profile.location &&
              [user.profile.location.city, user.profile.location.country]
                .filter(Boolean)
                .join(', '),
          ],
        ].filter(([, value]) => value) as InfoTableProps['rows'])
      : [];
    const threadReferences =
      user && user.threadReferences ? user.threadReferences : [];
    const threadVoteGroups = isProfile
      ? [
          {
            id: 'thread-votes-received-positive',
            label: 'Positive votes received',
            reference: 'yes',
            votes: threadReferences.filter(
              referenceThread =>
                getReferenceUserId(referenceThread, 'userTo') === userId &&
                referenceThread.reference === 'yes',
            ),
          },
          {
            id: 'thread-votes-received-negative',
            label: 'Negative votes received',
            reference: 'no',
            votes: threadReferences.filter(
              referenceThread =>
                getReferenceUserId(referenceThread, 'userTo') === userId &&
                referenceThread.reference === 'no',
            ),
          },
          {
            id: 'thread-votes-gave-positive',
            label: 'Positive votes gave',
            reference: 'yes',
            votes: threadReferences.filter(
              referenceThread =>
                getReferenceUserId(referenceThread, 'userFrom') === userId &&
                referenceThread.reference === 'yes',
            ),
          },
          {
            id: 'thread-votes-gave-negative',
            label: 'Negative votes gave',
            reference: 'no',
            votes: threadReferences.filter(
              referenceThread =>
                getReferenceUserId(referenceThread, 'userFrom') === userId &&
                referenceThread.reference === 'no',
            ),
          },
        ]
      : [];
    const hasThreadVotes = threadVoteGroups.some(({ votes }) => votes.length);
    const roleChangeConfirmation =
      isProfile && pendingRoleChange
        ? getRoleChangeConfirmation(
            pendingRoleChange.role,
            pendingRoleChange.action,
            user.profile.username || 'this member',
          )
        : null;
    const viewer = this.props.viewer;

    return (
      <>
        <AdminHeader />
        <div className="container admin-user-page">
          {!isProfile && (
            <div className="admin-user-page__search">
              <form
                onSubmit={this.queryUser}
                className="form-inline admin-user-search-form"
              >
                <input
                  aria-label="Member username, email or ID"
                  className="form-control input-lg"
                  onChange={this.onQueryChange}
                  placeholder="Member username, email or ID"
                  size={32}
                  type="search"
                  value={query}
                />
                <div className="checkbox">
                  <label>
                    <input
                      checked={hideObviousSpamUsers}
                      onChange={this.onHideObviousSpamUsersChange}
                      type="checkbox"
                    />{' '}
                    Hide obvious spam
                  </label>
                </div>
              </form>

              {isSearching && (
                <p className="admin-user-loading text-muted">
                  Loading member...
                </p>
              )}
            </div>
          )}

          {!isProfile && (
            <AdminUserResultsTable
              onPageChange={this.onMatchingUsersPageChange}
              onSortChange={this.onMatchingUsersSortChange}
              pagination={matchingUsersPagination}
              sort={matchingUsersSort}
              userResults={visibleMatchingUsers}
            />
          )}

          {!isProfile && hiddenObviousSpamUserCount > 0 && (
            <p className="text-muted">
              {hiddenObviousSpamUserCount} likely spam hidden.
            </p>
          )}

          {!isProfile && hasNoMatchingUsers && (
            <p>
              <br />
              <em className="text-muted">No matching members found.</em>
            </p>
          )}

          {isProfile && (
            <>
              <div className="admin-user-report-header">
                <h3>
                  <strong>{profileLabel}</strong>
                </h3>

                <div className="admin-user-actions">
                  {user.profile.username && !isSuspended && (
                    <a
                      className="btn btn-default"
                      href={`/profile/${user.profile.username}`}
                    >
                      Public profile
                    </a>
                  )}
                  {[
                    {
                      role: 'suspended',
                      color: 'danger',
                      label: 'Suspend',
                    },
                    ...(!isSuspended || isShadowbanned
                      ? [
                          {
                            role: 'shadowban',
                            color: 'danger',
                            label: 'Shadow ban',
                          },
                        ]
                      : []),
                    ...(isSuspended
                      ? []
                      : [
                          {
                            role: 'volunteer',
                            color: 'success',
                            label: 'Make volunteer',
                          },
                          {
                            role: 'volunteer-alumni',
                            color: 'success',
                            label: 'Make volunteer alumni',
                          },
                        ]),
                  ].map(({ role, color, label }) =>
                    role === 'shadowban' && isShadowbanned ? (
                      <button
                        key={role}
                        type="button"
                        className="btn btn-default"
                        disabled={isSettingUserRole}
                        onClick={() =>
                          this.handleUserRoleChange('shadowban', 'remove')
                        }
                      >
                        Unshadowban
                      </button>
                    ) : (
                      <button
                        key={role}
                        className={`btn btn-${color}`}
                        disabled={
                          user.profile.roles.includes(role) || isSettingUserRole
                        }
                        onClick={() => this.handleUserRoleChange(role)}
                      >
                        {label}
                      </button>
                    ),
                  )}
                  <Tooltip
                    id="welcome-team-role-help"
                    placement="bottom"
                    tooltip={ROLE_DESCRIPTIONS['welcome-team']}
                  >
                    <button
                      type="button"
                      className="btn btn-success"
                      aria-describedby="welcome-team-role-description"
                      disabled={isSettingUserRole}
                      onClick={() =>
                        this.handleUserRoleChange(
                          'welcome-team',
                          this.hasRole('welcome-team') ? 'remove' : 'add',
                        )
                      }
                    >
                      {this.hasRole('welcome-team')
                        ? 'Remove greeter'
                        : 'Make greeter'}
                    </button>
                  </Tooltip>
                  <span id="welcome-team-role-description" className="sr-only">
                    {ROLE_DESCRIPTIONS['welcome-team']}
                  </span>
                </div>
              </div>

              <div id="roles" className="admin-user-roles">
                <div className="panel-body">
                  <ul className="list-inline">
                    {user.profile.roles
                      .filter(role => role !== 'user')
                      .map(role => (
                        <li key={role}>
                          <Tooltip
                            id={`member-role-${role}-help`}
                            placement="bottom"
                            tooltip={
                              ROLE_DESCRIPTIONS[role] ||
                              'Role stored on this member.'
                            }
                          >
                            <span
                              tabIndex={0}
                              aria-describedby={`member-role-${role}-description`}
                            >
                              {formatRoleLabel(role)}
                            </span>
                          </Tooltip>
                          <span
                            id={`member-role-${role}-description`}
                            className="sr-only"
                          >
                            {ROLE_DESCRIPTIONS[role] ||
                              'Role stored on this member.'}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              </div>

              <h4 id="stats">
                <a href="#stats">Stats</a>
              </h4>
              <div className="panel panel-default admin-user">
                <div className="panel-body">
                  <UserState user={user.profile} />
                  <ul className="list-inline">
                    <li>
                      <strong>Messages</strong>
                    </li>
                    <li>{user.messageFromCount || 0} sent</li>
                    <li>{user.messageToCount || 0} received</li>
                    <li>
                      <a href={`/admin/threads?userId=${user.profile._id}`}>
                        {user.threadCount || 0} threads total
                      </a>
                    </li>
                  </ul>
                  <ul className="list-inline">
                    <li>
                      <strong>Thread votes received</strong>
                    </li>
                    <li>
                      <a
                        className="text-success"
                        href="#thread-votes-received-positive"
                      >
                        {user.threadReferencesReceivedYes} positive
                      </a>
                    </li>
                    <li>
                      <a
                        className="text-danger"
                        href="#thread-votes-received-negative"
                      >
                        {user.threadReferencesReceivedNo} negative
                      </a>
                    </li>
                  </ul>
                  <ul className="list-inline">
                    <li>
                      <strong>Thread votes gave</strong>
                    </li>
                    <li>
                      <a
                        className="text-success"
                        href="#thread-votes-gave-positive"
                      >
                        {user.threadReferencesSentYes} positive
                      </a>
                    </li>
                    <li>
                      <a
                        className="text-danger"
                        href="#thread-votes-gave-negative"
                      >
                        {user.threadReferencesSentNo} negative
                      </a>
                    </li>
                  </ul>
                  <p>
                    <strong>{user.contacts.length} contact(s)</strong>
                  </p>
                  <p>
                    <strong>
                      {user.offers.length} hosting or meet offer(s)
                    </strong>
                  </p>
                  <UserEmailConfirmLink user={user.profile} />
                </div>
              </div>

              {hasThreadVotes && (
                <>
                  <h4 id="thread-votes">
                    <a href="#thread-votes">Thread votes</a>
                  </h4>
                  <div className="panel panel-default">
                    <div className="panel-body">
                      {threadVoteGroups.map(
                        ({ id, label, votes }) =>
                          votes.length > 0 && (
                            <section id={id} key={id}>
                              <h5>{label}</h5>
                              <ul className="list-unstyled">
                                {votes.map(referenceThread => (
                                  <AdminReferenceVoteItem
                                    key={referenceThread._id}
                                    referenceThread={referenceThread}
                                    showBadge
                                    showMessagesLink
                                  />
                                ))}
                              </ul>
                            </section>
                          ),
                      )}
                    </div>
                  </div>
                </>
              )}

              <AdminNotes id={userId} refreshToken={this.state.notesRevision} />

              {isRestricted && (
                <>
                  <h4 id="potential-matches">
                    <a href="#potential-matches">Potential related accounts</a>
                  </h4>
                  <div className="panel panel-warning">
                    <div className="panel-body">
                      <p className="text-muted">
                        Investigation leads only. Matches do not change account
                        state automatically.
                      </p>
                      <table className="table table-condensed table-striped">
                        <thead>
                          <tr>
                            <th>Member</th>
                            <th>Email</th>
                            <th>Roles</th>
                            <th>Matched on</th>
                            <th>Acquisition story</th>
                          </tr>
                        </thead>
                        <tbody>
                          {potentialMatches.map(match => (
                            <tr key={match._id}>
                              <td>
                                <a href={getAdminUserHref(match)}>
                                  {match.displayName || match.username}
                                </a>
                                <div className="text-muted">
                                  @{match.username}
                                </div>
                              </td>
                              <td>{match.email}</td>
                              <td>
                                {match.roles.map(formatRoleLabel).join(', ')}
                              </td>
                              <td>{match.matchReasons.join(', ')}</td>
                              <td>{match.acquisitionStory}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!potentialMatches.length && (
                        <p>
                          <em>No potential related accounts found.</em>
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}

              <h4 id="profile">
                <a href="#profile">Profile</a>
                <details className="admin-section-raw-data">
                  <summary>raw data</summary>
                  <Json content={user.profile} />
                </details>
              </h4>
              <div className="panel panel-default">
                <div className="panel-body">
                  <InfoTable rows={profileRows} />
                </div>
              </div>
            </>
          )}

          {user && (
            <>
              <h4 id="offers">
                <a href="#offers">Hosting & meeting offers</a>
              </h4>
              <div className="panel panel-default">
                <div className="panel-body">
                  {user.offers.length ? (
                    user.offers.map(offer => {
                      const formattedLocation = formatLocation(offer.location);
                      const searchLocation = formatLocationForSearch(
                        offer.location,
                      );

                      return (
                        <div className="admin-readable-item" key={offer._id}>
                          <InfoTable
                            rows={[
                              ['Type', offer.type],
                              ['Status', offer.status],
                              ['Description', offer.description],
                              ['Location', formattedLocation],
                              ['Created', formatDate(offer.created)],
                              ['Updated', formatDate(offer.updated)],
                            ]}
                          />
                          <p>
                            <a
                              href={`/search?offer=${offer._id}`}
                              className="btn btn-sm btn-default"
                            >
                              Show offer on map
                            </a>
                            {formattedLocation && (
                              <a
                                href={`/search?location=${searchLocation}`}
                                className="btn btn-sm btn-default"
                              >
                                Show location on map
                              </a>
                            )}
                          </p>
                          <details>
                            <summary>Raw offer data</summary>
                            <Json content={offer} />
                          </details>
                        </div>
                      );
                    })
                  ) : (
                    <p>
                      <em>{"Member doesn't have any saved offers."}</em>
                    </p>
                  )}
                </div>
              </div>

              <h4 id="contacts">
                <a href="#contacts">Contacts</a>
              </h4>
              <div className="panel panel-default">
                <div className="panel-body">
                  {user.contacts.length ? (
                    <table className="table table-condensed table-striped">
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...user.contacts]
                          .sort(newestFirstByCreated)
                          .map(contact => {
                            const contactMember = getContactOtherMember(
                              contact,
                              userId,
                            );
                            const contactName =
                              get(contactMember, ['username']) ||
                              get(contactMember, ['displayName']) ||
                              'Unknown member';
                            const contactMemberId = get(contactMember, ['_id']);

                            return (
                              <tr key={contact._id}>
                                <td>
                                  {contactMemberId ? (
                                    <a
                                      href={getAdminUserHref({
                                        _id: contactMemberId,
                                        username: get(contactMember, [
                                          'username',
                                        ]),
                                      })}
                                    >
                                      {contactName}
                                    </a>
                                  ) : (
                                    contactName
                                  )}
                                </td>
                                <td>{formatDate(contact.created)}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  ) : (
                    <p>
                      <em>{"Member doesn't have any contacts."}</em>
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
          {isProfile && user.profile.username && viewer?._id && (
            <section
              className="admin-user-embedded-profile"
              aria-labelledby="reported-member-profile-heading"
            >
              <h4 id="reported-member-profile-heading">Public profile</h4>
              <ProfilePage
                currentPath={`/profile/${encodeURIComponent(
                  user.profile.username,
                )}`}
                embedded
                profileUsername={user.profile.username}
                user={viewer as UserProfile}
              />
            </section>
          )}
        </div>
        <Modal
          show={Boolean(roleChangeConfirmation)}
          onHide={this.cancelUserRoleChange}
          keyboard={!isSettingUserRole}
          backdrop={isSettingUserRole ? 'static' : true}
          aria-labelledby="admin-role-change-title"
        >
          {roleChangeConfirmation && (
            <>
              <Modal.Header>
                <Modal.Title id="admin-role-change-title">
                  {roleChangeConfirmation.title}
                </Modal.Title>
              </Modal.Header>
              <Modal.Body>
                {roleChangeConfirmation.message && (
                  <p>{roleChangeConfirmation.message}</p>
                )}
                {roleChangeError === 'change' && (
                  <p role="alert">
                    Could not change the role. Please try again.
                  </p>
                )}
                {roleChangeError === 'refresh' && (
                  <p role="alert">
                    The role was updated, but member details could not be
                    refreshed. Close this dialog and reload the report.
                  </p>
                )}
                {isSettingUserRole && (
                  <p role="status" aria-live="polite">
                    Updating role…
                  </p>
                )}
              </Modal.Body>
              <Modal.Footer>
                <button
                  type="button"
                  className="btn btn-default"
                  onClick={this.cancelUserRoleChange}
                  disabled={isSettingUserRole}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={this.confirmUserRoleChange}
                  disabled={isSettingUserRole}
                >
                  {isSettingUserRole
                    ? 'Updating…'
                    : roleChangeSucceeded
                    ? 'Close'
                    : roleChangeConfirmation.confirmLabel}
                </button>
              </Modal.Footer>
            </>
          )}
        </Modal>
      </>
    );
  }
}
