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

function SortableHeader({ column, label, onSortChange, sort }) {
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
}) {
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
                onSortChange={onSortChange}
                sort={sort}
              />
              <SortableHeader
                column="username"
                label="Username"
                onSortChange={onSortChange}
                sort={sort}
              />
              <SortableHeader
                column="email"
                label="Email"
                onSortChange={onSortChange}
                sort={sort}
              />
              <SortableHeader
                column="created"
                label="Signed up"
                onSortChange={onSortChange}
                sort={sort}
              />
              <SortableHeader
                column="lastIpAddress"
                label="Last IP"
                onSortChange={onSortChange}
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
      {pagination && (
        <div className="panel-footer">
          <span>
            {pagination.total} user(s). Page {pagination.page} of{' '}
            {Math.max(pagination.totalPages, 1)}.
          </span>{' '}
          <button
            className="btn btn-default btn-sm"
            disabled={pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
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
            onClick={() => onPageChange(pagination.page + 1)}
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
