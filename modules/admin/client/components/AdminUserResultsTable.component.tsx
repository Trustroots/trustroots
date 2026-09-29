// External dependencies
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import UserLink from './UserLink.component';
import UserState from './UserState.component';
import ZendeskInboxSearch from './ZendeskInboxSearch.component';
import { formatAdminDate, isSuspendedUser } from './userSearch.helpers';

const USER_SORT_COLUMNS = [
  'created',
  'displayName',
  'email',
  'lastIpAddress',
  'username',
];
type UserSortColumn = (typeof USER_SORT_COLUMNS)[number];

interface UserSort {
  column: UserSortColumn;
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
  column: UserSortColumn;
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
  sort: UserSort;
  userResults: UserResult[];
}

function SortableHeader({ column, label, onSortChange, sort }: SortableHeaderProps) {
  const isActive = sort.column === column;
  const direction = isActive ? sort.direction : 'none';
  const nextDirection =
    isActive && sort.direction === 'ascending' ? 'descending' : 'ascending';

  return (
    <th aria-sort={direction}>
      <button
        className="btn btn-link admin-user-results-sort"
        onClick={() => onSortChange({ column, direction: nextDirection })}
        type="button"
      >
        {label}
        {isActive && (sort.direction === 'ascending' ? ' ▲' : ' ▼')}
      </button>
    </th>
  );
}

SortableHeader.propTypes = {
  column: PropTypes.oneOf(USER_SORT_COLUMNS).isRequired,
  label: PropTypes.string.isRequired,
  onSortChange: PropTypes.func.isRequired,
  sort: PropTypes.shape({
    column: PropTypes.string,
    direction: PropTypes.oneOf(['ascending', 'descending']),
  }).isRequired,
};

export default function AdminUserResultsTable({
  onPageChange,
  onSortChange,
  pagination,
  showPublicProfileLink,
  showUserState,
  showZendeskActions,
  sort,
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
          <button
            className="btn btn-default btn-sm"
            disabled={pagination.page <= 1}
            onClick={() => onPageChange?.(pagination.page - 1)}
            type="button"
          >
            Previous
          </button>{' '}
          <button
            className="btn btn-default btn-sm"
            disabled={
              pagination.totalPages === 0 ||
              pagination.page >= pagination.totalPages
            }
            onClick={() => onPageChange?.(pagination.page + 1)}
            type="button"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

AdminUserResultsTable.propTypes = {
  onPageChange: PropTypes.func,
  onSortChange: PropTypes.func,
  pagination: PropTypes.shape({
    page: PropTypes.number.isRequired,
    pageSize: PropTypes.number.isRequired,
    total: PropTypes.number.isRequired,
    totalPages: PropTypes.number.isRequired,
  }),
  showPublicProfileLink: PropTypes.bool,
  showUserState: PropTypes.bool,
  showZendeskActions: PropTypes.bool,
  sort: PropTypes.shape({
    column: PropTypes.oneOf(USER_SORT_COLUMNS).isRequired,
    direction: PropTypes.oneOf(['ascending', 'descending']).isRequired,
  }),
  userResults: PropTypes.array.isRequired,
};

AdminUserResultsTable.defaultProps = {
  onPageChange: () => {},
  onSortChange: () => {},
  pagination: null,
  showPublicProfileLink: false,
  showUserState: false,
  showZendeskActions: false,
  sort: {
    column: 'username',
    direction: 'ascending',
  },
};
