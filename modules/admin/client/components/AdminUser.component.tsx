import MemberFlag from './MemberFlag.component';
// External dependencies
import get from 'lodash/get';
import { formatRoleLabel } from '../utils/role-label';
import { getAdminUserHref } from '../utils/member-url';
import {
  formatAdminDateTime,
  getAdminDateTimeAttribute,
} from '../utils/admin-date';
import { useNavigate, useSearch } from '@tanstack/react-router';
import React, {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@trustroots/ui/Modal';

// Internal dependencies
import {
  getUser,
  getUserByUsername as getUserRecordByUsername,
  listUsersByLastIpHash,
  searchUsers,
  setUserRole,
  deleteMember,
} from '../api/users.api';
import AdminHeader from './AdminHeader.component';
import UnsuspendMember from './UnsuspendMember.component';
import AdminNotes from './AdminNotes';
import { NetworkConnectionsPanel } from './NetworkConnections.component';
import AdminReferenceVoteItem from './AdminReferenceVoteItem.component';
import AdminUserResultsTable from './AdminUserResultsTable.component';
import Json from './Json.component';
import UserEmailConfirmLink from './UserEmailConfirmLink.component';
import UserState from './UserState.component';
import { Tooltip } from '@trustroots/ui/Tooltip';
import ProfilePage from '@/modules/users/client/components/ProfilePage.component';
import type { AuthUser } from '@/modules/core/client/react-app/auth';
import type { UserProfile } from '@/modules/users/client/types';
import {
  SEARCH_STRING_LIMIT,
  getReferenceUserId,
  isExactUserMatch,
  isMongoObjectId,
  normalizeAdminQuery,
  isSuspendedUser,
} from './userSearch.helpers';
import { Button } from '@trustroots/ui/Button';
import { Input } from '@trustroots/ui/Input';
import { Textarea } from '@trustroots/ui/Textarea';

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
  nostrNpub?: string;
  acquisitionStory?: string;
  roles: string[];
  public?: boolean;
  created?: string | number;
  seen?: string | number;
  lastIpHash?: string;
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
  flagged:
    'Internal moderation follow-up flag. Grants no permissions and does not restrict the account.',
  'welcome-team':
    'Greeters can view acquisition stories and see members who blocked their account.',
  admin: 'Full access to administration and moderation tools.',
  'support-team':
    'Support volunteers can triage requests, investigate reported member pairs, view account details and use greeter tools.',
  moderator: 'Legacy moderation role retained for historical accounts.',
  shadowban:
    'Member can use the site, but their profile and outreach are hidden from others.',
  suspended: 'Member access is blocked until an administrator intervenes.',
  volunteer: 'Current Trustroots volunteer.',
  'volunteer-alumni': 'Former Trustroots volunteer.',
};

interface MemberExperienceStats {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  unpublished: number;
}

function ExperienceStats({
  title,
  stats = { total: 0, positive: 0, negative: 0, neutral: 0, unpublished: 0 },
}: {
  title: string;
  stats?: MemberExperienceStats;
}) {
  return (
    <section className="admin-member-stat" aria-label={title}>
      <h5>{title}</h5>
      <p className="admin-member-stat-total">{stats.total} total</p>
      <ul>
        <li className="text-success">{stats.positive} positive</li>
        <li className="text-danger">{stats.negative} negative</li>
        <li>{stats.neutral} neutral</li>
        <li>{stats.unpublished} unpublished</li>
      </ul>
    </section>
  );
}

export interface MemberRecord {
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
  experiencesReceived?: MemberExperienceStats;
  experiencesWritten?: MemberExperienceStats;
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
  isSettingUserRole: boolean;
  isSearching: boolean;
  notesRevision: number;
  matchingUsersIpHash: string | null;
  matchingUsersPagination: MemberList['pagination'];
  matchingUsersSort: MemberSort;
  matchingUsersSource: 'ip' | 'search' | null;
  matchingUsers: MemberRecord[];
  query: string;
  user: MemberRecord | false;
  roleChangeError?: 'change' | 'refresh' | false;
  roleChangeSucceeded: boolean;
  deletingMember: boolean;
  deleteDialogOpen: boolean;
  deleteUsername: string;
  deleteReason: string;
  deleteKeywords: string;
  deleteError: boolean;
  deleteSucceeded: boolean;
  deleteCleanupIncomplete: boolean;
  pendingRoleChange: {
    role: string;
    action?: 'add' | 'remove';
  } | null;
}

interface InfoTableProps {
  rows: Array<[string, React.ReactNode | null | undefined]>;
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
  if (role === 'support-team') {
    return {
      title: `${action === 'remove' ? 'Remove' : 'Add'} ${username} ${
        action === 'remove' ? 'from' : 'to'
      } the support team?`,
      message: ROLE_DESCRIPTIONS['support-team'],
      confirmLabel: 'Confirm support role change',
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

export function InfoTable({ rows }: InfoTableProps) {
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

interface AdminUserProps {
  username?: string;
  viewer?: AuthUser | null;
}

interface AdminUserRouteProps extends AdminUserProps {
  navigate: ReturnType<typeof useNavigate>;
  search: { id?: string; ipHash?: string; q?: string };
}

export function AdminUserContent({
  navigate,
  search,
  username,
  viewer,
}: AdminUserRouteProps) {
  const [state, setState] = useState<AdminUserState>({
    hasSearched: false,
    isSettingUserRole: false,
    isSearching: false,
    notesRevision: 0,
    matchingUsersIpHash: null,
    matchingUsersPagination: null,
    matchingUsersSort: DEFAULT_MEMBER_LIST_SORT,
    matchingUsersSource: null,
    matchingUsers: [],
    query: '',
    user: false,
    pendingRoleChange: null,
    roleChangeSucceeded: false,
    deletingMember: false,
    deleteDialogOpen: false,
    deleteUsername: '',
    deleteReason: '',
    deleteKeywords: '',
    deleteError: false,
    deleteSucceeded: false,
    deleteCleanupIncomplete: false,
  });

  function updateState(
    patch:
      | Partial<AdminUserState>
      | ((state: AdminUserState) => Partial<AdminUserState>),
  ) {
    setState(current => ({
      ...current,
      ...(typeof patch === 'function' ? patch(current) : patch),
    }));
  }

  useEffect(() => {
    const { id, ipHash, q: query } = search;
    if (username) {
      updateState({ query: username });
      void getUserByUsername(username);
    } else if (id && isMongoObjectId(id)) {
      void getUserById(id);
    } else if (ipHash) {
      void getUsersByLastIpHash(ipHash);
    } else if (query) {
      updateState({ query });
      void queryUser(null, { query });
    }
  }, []);

  function onQueryChange(event: ChangeEvent<HTMLInputElement>) {
    const query = event.target.value;
    const normalizedQuery = normalizeAdminQuery(query);
    updateState({ query });

    const updatedSearch = !query
      ? {}
      : isMongoObjectId(normalizedQuery)
        ? { id: normalizedQuery }
        : { q: query };
    void navigate({
      hash: true,
      search: (current: Record<string, string>) => ({
        ...current,
        id: undefined,
        ipHash: undefined,
        q: undefined,
        ...updatedSearch,
      }),
      to: '/admin/user',
    });
  }

  function onMatchingUsersPageChange(page: number) {
    if (state.matchingUsersSource === 'ip') {
      return getUsersByLastIpHash(state.matchingUsersIpHash, { page });
    }
    return queryUser(null, { page });
  }

  function onMatchingUsersSortChange(sort: MemberSort) {
    updateState({ matchingUsersSort: sort });
    if (state.matchingUsersSource === 'ip') {
      void getUsersByLastIpHash(state.matchingUsersIpHash, { page: 1, sort });
    } else {
      void queryUser(null, { page: 1, sort });
    }
  }

  function handleUserRoleChange(role: string, action?: 'add' | 'remove') {
    if (state.user && state.user.profile?._id) {
      updateState({
        pendingRoleChange: { role, action },
        roleChangeError: false,
        roleChangeSucceeded: false,
      });
    }
  }

  function cancelUserRoleChange() {
    if (!state.isSettingUserRole) {
      updateState({
        pendingRoleChange: null,
        roleChangeError: false,
        roleChangeSucceeded: false,
      });
    }
  }

  function openDeleteDialog() {
    updateState({
      deleteDialogOpen: true,
      deleteUsername: '',
      deleteReason: '',
      deleteKeywords: '',
      deleteError: false,
    });
  }

  function cancelDeleteDialog() {
    if (!state.deletingMember) {
      updateState({ deleteDialogOpen: false });
    }
  }

  async function confirmDeleteMember() {
    const user = state.user;
    if (
      !user ||
      !isSuspendedUser(user.profile) ||
      !user.profile.username ||
      state.deletingMember ||
      state.deleteUsername !== user.profile.username ||
      !state.deleteReason.trim()
    )
      return;
    const reason = state.deleteReason.trim();
    const keywords = state.deleteKeywords
      .split(',')
      .map(keyword => keyword.trim())
      .filter(Boolean);
    updateState({ deletingMember: true, deleteError: false });
    try {
      const result = await deleteMember(
        user.profile._id,
        user.profile.username,
        reason,
        keywords,
      );
      updateState({
        deleteDialogOpen: false,
        user: false,
        query: '',
        hasSearched: true,
        deleteSucceeded: true,
        deleteCleanupIncomplete: result.cleanupIncomplete,
      });
    } catch {
      updateState({ deleteError: true });
    } finally {
      updateState({ deletingMember: false });
    }
  }

  async function confirmUserRoleChange() {
    const id = state.user && state.user.profile?._id;
    const { pendingRoleChange, isSettingUserRole, roleChangeSucceeded } = state;
    if (!id || !pendingRoleChange || isSettingUserRole) {
      return;
    }
    if (roleChangeSucceeded) {
      cancelUserRoleChange();
      return;
    }

    updateState({ isSettingUserRole: true, roleChangeError: false });
    try {
      if (pendingRoleChange.action) {
        await setUserRole(id, pendingRoleChange.role, pendingRoleChange.action);
      } else {
        await setUserRole(id, pendingRoleChange.role);
      }
      updateState(({ notesRevision }) => ({
        notesRevision: notesRevision + 1,
        roleChangeSucceeded: true,
      }));
      try {
        const user = await getUser(id);
        updateState({ user, pendingRoleChange: null });
      } catch {
        updateState({ roleChangeError: 'refresh' });
      }
    } catch {
      updateState({ roleChangeError: 'change' });
    } finally {
      updateState({ isSettingUserRole: false });
    }
  }

  async function queryUser(
    event: FormEvent<HTMLFormElement> | null,
    options: { page?: number; sort?: MemberSort; query?: string } = {},
  ) {
    event?.preventDefault();
    const query = normalizeAdminQuery(options.query ?? state.query);
    if (query.length < SEARCH_STRING_LIMIT) {
      return;
    }
    if (isMongoObjectId(query)) {
      await getUserById(query);
      return;
    }

    updateState({
      hasSearched: true,
      isSearching: true,
      matchingUsers: [],
      user: false,
    });
    const memberList: MemberList = await searchUsers(query, {
      page: options.page || 1,
      sort: options.sort || state.matchingUsersSort,
    });
    const exactMatch = memberList.users.find(user =>
      isExactUserMatch(query, user),
    );
    if (exactMatch) {
      await getUserById(exactMatch._id);
      return;
    }

    updateState({
      isSearching: false,
      matchingUsers: memberList.users,
      matchingUsersPagination: memberList.pagination,
      matchingUsersSort: memberList.sort,
      matchingUsersSource: 'search',
    });
  }

  async function getUserById(id: string) {
    updateState({
      hasSearched: true,
      isSearching: true,
      matchingUsers: [],
      user: false,
    });
    if (isMongoObjectId(id)) {
      const user: MemberRecord | false = await getUser(id);
      updateState({ isSearching: false, user });
    }
  }

  async function getUserByUsername(username: string) {
    updateState({
      hasSearched: true,
      isSearching: true,
      matchingUsers: [],
      user: false,
    });
    try {
      const user: MemberRecord | false =
        await getUserRecordByUsername(username);
      updateState({ isSearching: false, user });
    } catch {
      updateState({ isSearching: false, user: false });
    }
  }

  async function getUsersByLastIpHash(
    ipHash: string | null,
    options: { page?: number; sort?: MemberSort } = {},
  ) {
    updateState({
      hasSearched: true,
      isSearching: true,
      matchingUsers: [],
      user: false,
    });
    const memberList: MemberList = await listUsersByLastIpHash(ipHash, {
      page: options.page || 1,
      sort: options.sort || state.matchingUsersSort,
    });
    updateState({
      isSearching: false,
      matchingUsers: memberList.users,
      matchingUsersIpHash: ipHash,
      matchingUsersPagination: memberList.pagination,
      matchingUsersSort: memberList.sort,
      matchingUsersSource: 'ip',
    });
  }

  function hasRole(role: string) {
    return get(state.user, ['profile', 'roles'], []).includes(role);
  }

  const {
    hasSearched,
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
  } = state;
  const isProfile = user && user.profile;
  const isSuspended = isSuspendedUser(get(user, ['profile']));
  const isShadowbanned = hasRole('shadowban');
  const isProfileVisible =
    isProfile && isProfile.public && !isSuspended && !isShadowbanned;
  const visibilityReasons: string[] = [];
  if (isSuspended) visibilityReasons.push('Account suspended');
  if (isShadowbanned) visibilityReasons.push('Account shadowbanned');
  if (isProfile && !isProfile.public) {
    if (
      isProfile.emailTemporary &&
      isProfile.emailTemporary === isProfile.email
    ) {
      visibilityReasons.push('Signup email has not been confirmed');
    } else if (!visibilityReasons.length) {
      visibilityReasons.push('Reason unknown');
    }
  }
  const isRestricted = get(user, ['profile', 'roles'], []).some(
    (role: string) => ['shadowban', 'suspended'].includes(role),
  );
  const potentialMatches = user ? user.potentialMatches || [] : [];
  const hasNoMatchingUsers =
    hasSearched && !isSearching && matchingUsers.length === 0;
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
          isProfileVisible && user.profile.username ? (
            <a href={`/profile/${user.profile.username}`}>
              {user.profile.username}
            </a>
          ) : (
            user.profile.username
          ),
        ],
        [
          'Public profile',
          isProfileVisible && user.profile.username && (
            <a href={`/profile/${user.profile.username}`}>
              /profile/{user.profile.username}
            </a>
          ),
        ],
        ['Email', user.profile.email],
        ['Temporary email', user.profile.emailTemporary],
        ['Nostr npub', user.profile.nostrNpub],
        ['Acquisition story', user.profile.acquisitionStory],
        [
          'Roles',
          user.profile.roles && user.profile.roles.length
            ? user.profile.roles.map(formatRoleLabel).join(', ')
            : null,
        ],
        ['Profile visible', isProfileVisible ? 'Yes' : 'No'],
        ['Visibility restrictions', visibilityReasons.join(', ')],
        ['Signed up', formatAdminDateTime(user.profile.created)],
        ['Last seen', formatAdminDateTime(user.profile.seen)],
        [
          'Shared IP',
          user.profile.lastIpHash && (
            <a
              href={`/admin/user?ipHash=${user.profile.lastIpHash}`}
              target="_self"
            >
              Find accounts using the same IP
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
  const deleteKeywords = state.deleteKeywords
    .split(',')
    .map(keyword => keyword.trim())
    .filter(Boolean);
  const invalidDeleteKeywords =
    deleteKeywords.length > 20 ||
    deleteKeywords.some(keyword => keyword.length > 80);

  return (
    <>
      <AdminHeader />
      <div className="container admin-user-page">
        {state.deleteSucceeded &&
          (state.deleteCleanupIncomplete ? (
            <p role="alert">
              Member account deleted, but some cleanup is incomplete. Staff
              follow-up is required.
            </p>
          ) : (
            <p role="status">Member deleted successfully.</p>
          ))}
        {!isProfile && (
          <div className="admin-user-page__search">
            <form
              onSubmit={queryUser}
              className="form-inline admin-user-search-form"
            >
              <Input
                aria-label="Member username, email or ID"
                fieldSize="lg"
                className="tw:max-w-[520px]"
                onChange={onQueryChange}
                placeholder="Member username, email or ID"
                size={32}
                type="search"
                value={query}
              />
            </form>

            {isSearching && (
              <p className="admin-user-loading text-muted">Loading member...</p>
            )}
          </div>
        )}

        {!isProfile && (
          <AdminUserResultsTable
            onPageChange={onMatchingUsersPageChange}
            onSortChange={onMatchingUsersSortChange}
            pagination={matchingUsersPagination}
            sort={matchingUsersSort}
            userResults={matchingUsers}
          />
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

              <MemberFlag
                member={user.profile}
                onChanged={roles =>
                  updateState({
                    user: { ...user, profile: { ...user.profile, roles } },
                  })
                }
              />
              <div className="admin-user-actions">
                {user.profile.username && isProfileVisible && (
                  <Button
                    render={<a href={`/profile/${user.profile.username}`} />}
                  >
                    Public profile
                  </Button>
                )}
                <div
                  className="admin-user-action-group"
                  role="group"
                  aria-label="Account access"
                >
                  <span className="admin-user-action-label">
                    Account access
                  </span>
                  {isSuspended && (
                    <UnsuspendMember
                      member={user.profile}
                      onRefresh={async () => {
                        const refreshed = await getUser(user.profile._id);
                        updateState({ user: refreshed });
                      }}
                    />
                  )}
                  {[
                    {
                      role: 'suspended',
                      label: 'Suspend',
                    },
                    ...(!isSuspended || isShadowbanned
                      ? [
                          {
                            role: 'shadowban',
                            label: 'Shadow ban',
                          },
                        ]
                      : []),
                  ].map(({ role, label }) =>
                    role === 'shadowban' && isShadowbanned ? (
                      <Button
                        key={role}
                        type="button"

                        disabled={isSettingUserRole}
                        onClick={() =>
                          handleUserRoleChange('shadowban', 'remove')
                        }
                      >
                        Unshadowban
                      </Button>
                    ) : (
                      <Button
                        key={role}
                        intent="danger"
                        disabled={
                          user.profile.roles.includes(role) || isSettingUserRole
                        }
                        onClick={() => handleUserRoleChange(role)}
                      >
                        {label}
                      </Button>
                    ),
                  )}
                </div>
                <div>
                  <Button
                    type="button"
                    intent="danger"
                    disabled={
                      !isSuspended ||
                      hasRole('admin') ||
                      Boolean(viewer?._id && viewer._id === user.profile._id)
                    }
                    onClick={() => openDeleteDialog()}
                  >
                    Delete member
                  </Button>
                  {!isSuspended && (
                    <p className="text-muted">
                      Suspend this member before deleting their account.
                    </p>
                  )}
                </div>
                <div
                  className="admin-user-action-group"
                  role="group"
                  aria-label="Team roles"
                >
                  <span className="admin-user-action-label">Team roles</span>
                  {!isSuspended &&
                    [
                      { role: 'volunteer', label: 'Make volunteer' },
                      {
                        role: 'volunteer-alumni',
                        label: 'Make volunteer alumni',
                      },
                    ].map(({ role, label }) => (
                      <Button
                        key={role}
                        type="button"

                        disabled={
                          user.profile.roles.includes(role) || isSettingUserRole
                        }
                        onClick={() => handleUserRoleChange(role)}
                      >
                        {label}
                      </Button>
                    ))}
                  <Tooltip
                    placement="bottom"
                    tooltip={ROLE_DESCRIPTIONS['welcome-team']}
                  >
                    <Button
                      type="button"

                      aria-describedby="welcome-team-role-description"
                      disabled={isSettingUserRole}
                      onClick={() =>
                        handleUserRoleChange(
                          'welcome-team',
                          hasRole('welcome-team') ? 'remove' : 'add',
                        )
                      }
                    >
                      {hasRole('welcome-team')
                        ? 'Remove greeter'
                        : 'Make greeter'}
                    </Button>
                  </Tooltip>
                  <span id="welcome-team-role-description" className="sr-only">
                    {ROLE_DESCRIPTIONS['welcome-team']}
                  </span>
                  <Button
                    type="button"

                    disabled={isSettingUserRole}
                    title={ROLE_DESCRIPTIONS['support-team']}
                    onClick={() =>
                      handleUserRoleChange(
                        'support-team',
                        hasRole('support-team') ? 'remove' : 'add',
                      )
                    }
                  >
                    {hasRole('support-team')
                      ? 'Remove from support team'
                      : 'Add to support team'}
                  </Button>
                </div>
              </div>
            </div>

            <div id="roles" className="admin-user-roles">
              <div className="panel-body">
                {user.profile.roles.some(role => role !== 'user') && (
                  <span className="admin-user-action-label">Current roles</span>
                )}
                <ul className="list-inline" aria-label="Current roles">
                  {user.profile.roles
                    .filter(role => role !== 'user')
                    .map(role => (
                      <li key={role}>
                        <Tooltip
                          placement="bottom"
                          tooltip={
                            ROLE_DESCRIPTIONS[role] ||
                            'Role stored on this member.'
                          }
                        >
                          {role === 'welcome-team' ||
                          role === 'volunteer' ||
                          role === 'volunteer-alumni' ||
                          role === 'flagged' ? (
                            <a
                              href={`/admin/search-users?role=${encodeURIComponent(
                                role,
                              )}`}
                              aria-describedby={`member-role-${role}-description`}
                            >
                              {formatRoleLabel(role)}
                            </a>
                          ) : (
                            // Keyboard focus exposes the role description tooltip.
                            /* eslint-disable jsx-a11y/no-noninteractive-tabindex */
                            <span
                              tabIndex={0}
                              aria-describedby={`member-role-${role}-description`}
                            >
                              {formatRoleLabel(role)}
                            </span>
                            /* eslint-enable jsx-a11y/no-noninteractive-tabindex */
                          )}
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

            <div className="admin-member-report-grid">
              <div className="admin-member-box admin-member-box--wide">
                <h4 id="stats">
                  <a href="#stats">Stats</a>
                </h4>
                <section
                  className="panel panel-default admin-user admin-member-stats"
                  aria-labelledby="stats"
                >
                  <div className="panel-body">
                    <UserState user={user.profile} showRoles={false} />
                    <div className="admin-member-stats-grid">
                      <section
                        className="admin-member-stat"
                        aria-label="Messages"
                      >
                        <h5>Messages</h5>
                        <p className="admin-member-stat-total">
                          <a
                            href={
                              user.profile.username
                                ? `/admin/threads?username=${encodeURIComponent(user.profile.username)}`
                                : `/admin/threads?userId=${user.profile._id}`
                            }
                          >
                            {user.threadCount || 0} threads total
                          </a>
                        </p>
                        <ul>
                          <li>{user.messageFromCount || 0} sent</li>
                          <li>{user.messageToCount || 0} received</li>
                        </ul>
                      </section>
                      <ExperienceStats
                        title="Experiences received"
                        stats={user.experiencesReceived}
                      />
                      <ExperienceStats
                        title="Experiences written"
                        stats={user.experiencesWritten}
                      />
                      <section
                        className="admin-member-stat"
                        aria-label="Thread votes received"
                      >
                        <h5>Thread votes received</h5>
                        <ul>
                          <li>
                            <a
                              className="text-success"
                              href={`${
                                user.profile.username
                                  ? `/admin/threads?username=${encodeURIComponent(user.profile.username)}`
                                  : `/admin/threads?userId=${user.profile._id}`
                              }&vote=received-positive`}
                            >
                              {user.threadReferencesReceivedYes || 0} positive
                            </a>
                          </li>
                          <li>
                            <a
                              className="text-danger"
                              href={`${
                                user.profile.username
                                  ? `/admin/threads?username=${encodeURIComponent(user.profile.username)}`
                                  : `/admin/threads?userId=${user.profile._id}`
                              }&vote=received-negative`}
                            >
                              {user.threadReferencesReceivedNo || 0} negative
                            </a>
                          </li>
                        </ul>
                      </section>
                      <section
                        className="admin-member-stat"
                        aria-label="Thread votes given"
                      >
                        <h5>Thread votes given</h5>
                        <ul>
                          <li>
                            <a
                              className="text-success"
                              href={`${
                                user.profile.username
                                  ? `/admin/threads?username=${encodeURIComponent(user.profile.username)}`
                                  : `/admin/threads?userId=${user.profile._id}`
                              }&vote=given-positive`}
                            >
                              {user.threadReferencesSentYes || 0} positive
                            </a>
                          </li>
                          <li>
                            <a
                              className="text-danger"
                              href={`${
                                user.profile.username
                                  ? `/admin/threads?username=${encodeURIComponent(user.profile.username)}`
                                  : `/admin/threads?userId=${user.profile._id}`
                              }&vote=given-negative`}
                            >
                              {user.threadReferencesSentNo || 0} negative
                            </a>
                          </li>
                        </ul>
                      </section>
                      <section
                        className="admin-member-stat"
                        aria-label="Connections and offers"
                      >
                        <h5>Connections and offers</h5>
                        <ul>
                          <li>{user.contacts.length} contacts</li>
                          <li>{user.offers.length} hosting or meet offers</li>
                        </ul>
                      </section>
                    </div>
                    <p className="admin-member-stat-note">
                      Experience recommendations cover published experiences;
                      unpublished experiences are counted separately.
                    </p>
                    <div className="admin-member-email-status">
                      <UserEmailConfirmLink user={user.profile} />
                    </div>
                  </div>
                </section>
              </div>

              {hasThreadVotes && (
                <div className="admin-member-box">
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
                </div>
              )}
              <div className="admin-member-box">
                <NetworkConnectionsPanel key={userId} memberId={userId} />
              </div>
              <div className="admin-member-box">
                <AdminNotes id={userId} refreshToken={state.notesRevision} />
              </div>

              {isRestricted && (
                <div className="admin-member-box admin-member-box--wide">
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
                </div>
              )}
              <div className="admin-member-box">
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
              </div>
            </div>
          </>
        )}

        {user && (
          <div className="admin-member-report-grid">
            <div className="admin-member-box">
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
                              ['Created', formatAdminDateTime(offer.created)],
                              ['Updated', formatAdminDateTime(offer.updated)],
                            ]}
                          />
                          <p>
                            <Button
                              size="sm"
                              render={<a href={`/search?offer=${offer._id}`} />}
                            >
                              Show offer on map
                            </Button>
                            {formattedLocation && (
                              <Button
                                size="sm"
                                render={
                                  <a
                                    href={`/search?location=${searchLocation}`}
                                  />
                                }
                              >
                                Show location on map
                              </Button>
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
            </div>
            <div className="admin-member-box">
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
                                <td>
                                  <time
                                    dateTime={getAdminDateTimeAttribute(
                                      contact.created,
                                    )}
                                  >
                                    {formatAdminDateTime(contact.created)}
                                  </time>
                                </td>
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
            </div>
          </div>
        )}
        {isProfile && user.profile.username && viewer?._id && (
          <section
            className="admin-user-embedded-profile"
            aria-labelledby="reported-member-profile-heading"
          >
            <h4 id="reported-member-profile-heading">
              {isProfileVisible ? 'Public profile' : 'Hidden profile preview'}
            </h4>
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
        open={state.deleteDialogOpen}
        onClose={() => cancelDeleteDialog()}
        dismissible={!state.deletingMember}
      >
        <ModalHeader>
          <ModalTitle id="admin-delete-member-title">Delete member?</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p>
            This permanently deletes the suspended member account, offers,
            contacts and uploaded files. Existing messages, experiences and
            moderation records are retained. Enter the exact username and a
            reason (maximum 1000 characters).
          </p>
          <p>No confirmation email is sent to the member.</p>
          {state.deleteError && (
            <p role="alert">Could not delete this member. Please try again.</p>
          )}
          <label htmlFor="delete-member-username">Confirm username</label>
          <Input
            id="delete-member-username"
            value={state.deleteUsername}
            onChange={event =>
              updateState({ deleteUsername: event.target.value })
            }
            autoComplete="off"
          />
          <label htmlFor="delete-member-reason">Reason</label>
          <Textarea
            id="delete-member-reason"
            fieldSize="md"
            maxLength={1000}
            value={state.deleteReason}
            onChange={event =>
              updateState({ deleteReason: event.target.value })
            }
          />
          <label htmlFor="delete-member-keywords">Audit keywords</label>
          <Input
            id="delete-member-keywords"
            value={state.deleteKeywords}
            onChange={event =>
              updateState({ deleteKeywords: event.target.value })
            }
            placeholder="Comma-separated, up to 20"
          />
          <p className="text-muted">
            Optional audit labels only; they are not added to the signup
            watchlist.{' '}
            <a href="/admin/signup-review-rules">Manage signup watchlist</a>
          </p>
          {invalidDeleteKeywords && (
            <p role="alert">
              Use at most 20 keywords, each 80 characters or fewer.
            </p>
          )}
          {state.deletingMember && <p role="status">Deleting member…</p>}
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            onClick={() => updateState({ deleteDialogOpen: false })}
            disabled={state.deletingMember}
          >
            Cancel
          </Button>
          <Button
            type="button"
            intent="danger"
            onClick={() => void confirmDeleteMember()}
            disabled={
              state.deletingMember ||
              state.deleteUsername !== (user && user.profile.username) ||
              !state.deleteReason.trim() ||
              !isSuspended ||
              invalidDeleteKeywords
            }
          >
            {state.deletingMember ? 'Deleting…' : 'Delete permanently'}
          </Button>
        </ModalFooter>
      </Modal>
      <Modal
        open={Boolean(roleChangeConfirmation)}
        onClose={cancelUserRoleChange}
        dismissible={!isSettingUserRole}
      >
        {roleChangeConfirmation && (
          <>
            <ModalHeader>
              <ModalTitle id="admin-role-change-title">
                {roleChangeConfirmation.title}
              </ModalTitle>
            </ModalHeader>
            <ModalBody>
              {roleChangeConfirmation.message && (
                <p>{roleChangeConfirmation.message}</p>
              )}
              {roleChangeError === 'change' && (
                <p role="alert">Could not change the role. Please try again.</p>
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
            </ModalBody>
            <ModalFooter>
              <Button
                type="button"

                onClick={cancelUserRoleChange}
                disabled={isSettingUserRole}
              >
                Cancel
              </Button>
              <Button
                type="button"
                intent="danger"
                onClick={confirmUserRoleChange}
                disabled={isSettingUserRole}
              >
                {isSettingUserRole
                  ? 'Updating…'
                  : roleChangeSucceeded
                    ? 'Close'
                    : roleChangeConfirmation.confirmLabel}
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </>
  );
}

export default function AdminUser(props: AdminUserProps) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  return <AdminUserContent {...props} navigate={navigate} search={search} />;
}
