import React from 'react';

// Internal dependencies
import UserLink from './UserLink.component';
import UserState from './UserState.component';
import ZendeskInboxSearch from './ZendeskInboxSearch.component';
import { formatAdminDate, isSuspendedUser } from './userSearch.helpers';
import { Button } from '@trustroots/ui';

interface UserSort {
  column: string;
  direction: 'ascending' | 'descending';
}

interface UserResult {
  _id: string;
  created?: string | number | Date;
  email?: string;
  emailTemporary?: string;
  lastIpAddress?: string;
  username?: string;
  roles?: string[];
  profile?: { roles?: string[] };
}

interface UserPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface SortableHeaderProps {
  column: string;
  label: string;
  onSortChange: (sort: UserSort) => void;
  sort: UserSort;
}

interface AdminUserResultsTableProps {
  onPageChange?: (page: number) => void;
  onSortChange?: (sort: UserSort) => void;
  pagination?: UserPagination | null;
  showPublicProfileLink?: boolean;
  showUserState?: boolean;
  showZendeskActions?: boolean;
  sort?: UserSort;
  userResults: UserResult[];
}

function SortableHeader({
  column,
  label,
  onSortChange,
  sort,
}: SortableHeaderProps) {
  const isActive = sort.column === column;
  const direction = isActive ? sort.direction : 'none';
  const nextDirection =
    isActive && sort.direction === 'ascending' ? 'descending' : 'ascending';

  return (
    <th aria-sort={direction}>
      <Button
        variant="link"
        className="admin-user-results-sort"
        onClick={() => onSortChange({ column, direction: nextDirection })}
        type="button"
      >
        {label}
        {isActive && (sort.direction === 'ascending' ? ' ▲' : ' ▼')}
      </Button>
    </th>
  );
}

export default function AdminUserResultsTable({
  onPageChange = () => {},
  onSortChange = () => {},
  pagination = null,
  showPublicProfileLink = false,
  showUserState = false,
  showZendeskActions = false,
  sort = { column: 'username', direction: 'ascending' },
  userResults,
}: AdminUserResultsTableProps) {
  const sortChange = onSortChange || (() => {});
  if (!userResults.length) {
    return null;
  }

  return (
    <div className="panel panel-default">
      <div className="panel-body">
        <table className="table table-striped table-responsive">
          <thead>
            <tr>
              <SortableHeader
                column="displayName"
                label="Name"
                onSortChange={sortChange}
                sort={sort}
              />
              <SortableHeader
                column="username"
                label="Username"
                onSortChange={sortChange}
                sort={sort}
              />
              <SortableHeader
                column="email"
                label="Email"
                onSortChange={sortChange}
                sort={sort}
              />
              <SortableHeader
                column="created"
                label="Signed up"
                onSortChange={sortChange}
                sort={sort}
              />
              <SortableHeader
                column="lastIpAddress"
                label="Last IP"
                onSortChange={sortChange}
                sort={sort}
              />
            </tr>
          </thead>
          <tbody>
            {userResults.map(user => {
              const {
                _id,
                created,
                email,
                emailTemporary,
                lastIpAddress,
                username,
              } = user;
              const showProfileLink =
                showPublicProfileLink && !isSuspendedUser(user);
              return (
                <tr key={_id}>
                  <td className="admin-search-users__actions">
                    <UserLink user={user} />
                    {showUserState && <UserState user={user} />}
                    {showProfileLink && (
                      <a
                        className="admin-action"
                        href={`/profile/${username}`}
                        title="Public profile on Trustroots"
                      >
                        Public profile
                      </a>
                    )}
                  </td>
                  <td>
                    <span className="admin-copy-text">{username}</span>
                    {showZendeskActions && username && (
                      <ZendeskInboxSearch
                        className="admin-action admin-hidden-until-hover"
                        q={username}
                      />
                    )}
                  </td>
                  <td>
                    <span className="admin-copy-text">{email}</span>
                    {showZendeskActions && email && (
                      <ZendeskInboxSearch
                        className="admin-action admin-hidden-until-hover"
                        q={email}
                      />
                    )}
                    {emailTemporary && emailTemporary !== email && (
                      <>
                        <br />
                        <span className="admin-copy-text">
                          {emailTemporary}
                        </span>{' '}
                        (temporary email)
                        {showZendeskActions && (
                          <ZendeskInboxSearch
                            className="admin-action admin-hidden-until-hover"
                            q={emailTemporary}
                          />
                        )}
                      </>
                    )}
                  </td>
                  <td>{formatAdminDate(created)}</td>
                  <td>
                    {lastIpAddress && (
                      <a
                        href={`/admin/user?ip=${lastIpAddress}`}
                        target="_self"
                      >
                        {lastIpAddress}
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pagination && (
        <div className="panel-footer">
          <span>
            {pagination.total} user(s). Page {pagination.page} of{' '}
            {Math.max(pagination.totalPages, 1)}.
          </span>{' '}
          <Button
            variant="default"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => onPageChange?.(pagination.page - 1)}
            type="button"
          >
            Previous
          </Button>{' '}
          <Button
            variant="default"
            size="sm"
            disabled={
              pagination.totalPages === 0 ||
              pagination.page >= pagination.totalPages
            }
            onClick={() => onPageChange?.(pagination.page + 1)}
            type="button"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
