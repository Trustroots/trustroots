// External dependencies
import PropTypes from 'prop-types';
import React, { useMemo, useState } from 'react';

// Internal dependencies
import UserLink from './UserLink.component';
import UserState from './UserState.component';
import ZendeskInboxSearch from './ZendeskInboxSearch.component';
import { formatAdminDate, isSuspendedUser } from './userSearch.helpers';

const userSortValues = {
  created: user => {
    const timestamp = new Date(user.created).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  },
  displayName: user => String(user.displayName || '').toLowerCase(),
  email: user => String(user.email || '').toLowerCase(),
  lastIpAddress: user => String(user.lastIpAddress || ''),
  username: user => String(user.username || '').toLowerCase(),
};

function SortableHeader({ column, label, onSort, sort }) {
  const isActive = sort.column === column;
  const direction = isActive ? sort.direction : 'none';

  return (
    <th aria-sort={direction}>
      <button
        className="btn btn-link admin-user-results-sort"
        onClick={() => onSort(column)}
        type="button"
      >
        {label}
        {isActive && (sort.direction === 'ascending' ? ' ▲' : ' ▼')}
      </button>
    </th>
  );
}

SortableHeader.propTypes = {
  column: PropTypes.oneOf(Object.keys(userSortValues)).isRequired,
  label: PropTypes.string.isRequired,
  onSort: PropTypes.func.isRequired,
  sort: PropTypes.shape({
    column: PropTypes.string,
    direction: PropTypes.oneOf(['ascending', 'descending']),
  }).isRequired,
};

export default function AdminUserResultsTable({
  showLimitWarning,
  showPublicProfileLink,
  showUserState,
  showZendeskActions,
  userResults,
  usersLimit,
}) {
  const [sort, setSort] = useState({ column: null, direction: null });

  const sortedUserResults = useMemo(() => {
    if (!sort.column) {
      return userResults;
    }

    const direction = sort.direction === 'ascending' ? 1 : -1;
    const valueFor = userSortValues[sort.column];

    return userResults.slice().sort((left, right) => {
      const leftValue = valueFor(left);
      const rightValue = valueFor(right);
      const comparison =
        typeof leftValue === 'number'
          ? leftValue - rightValue
          : leftValue.localeCompare(rightValue);
      return comparison * direction;
    });
  }, [sort, userResults]);

  function sortBy(column) {
    setSort(currentSort => ({
      column,
      direction:
        currentSort.column === column && currentSort.direction === 'ascending'
          ? 'descending'
          : 'ascending',
    }));
  }

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
                onSort={sortBy}
                sort={sort}
              />
              <SortableHeader
                column="username"
                label="Username"
                onSort={sortBy}
                sort={sort}
              />
              <SortableHeader
                column="email"
                label="Email"
                onSort={sortBy}
                sort={sort}
              />
              <SortableHeader
                column="created"
                label="Signed up"
                onSort={sortBy}
                sort={sort}
              />
              <SortableHeader
                column="lastIpAddress"
                label="Last IP"
                onSort={sortBy}
                sort={sort}
              />
            </tr>
          </thead>
          <tbody>
            {sortedUserResults.map(user => {
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
                    {showZendeskActions && (
                      <ZendeskInboxSearch
                        className="admin-action admin-hidden-until-hover"
                        q={username}
                      />
                    )}
                  </td>
                  <td>
                    <span className="admin-copy-text">{email}</span>
                    {showZendeskActions && (
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
      {showLimitWarning && (
        <div className="panel-footer">
          {userResults.length} user(s).
          {userResults.length === usersLimit && (
            <p className="text-warning">
              There might be more results but {usersLimit} is maximum.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

AdminUserResultsTable.propTypes = {
  showLimitWarning: PropTypes.bool,
  showPublicProfileLink: PropTypes.bool,
  showUserState: PropTypes.bool,
  showZendeskActions: PropTypes.bool,
  userResults: PropTypes.array.isRequired,
  usersLimit: PropTypes.number,
};

AdminUserResultsTable.defaultProps = {
  showLimitWarning: false,
  showPublicProfileLink: false,
  showUserState: false,
  showZendeskActions: false,
  usersLimit: 0,
};
