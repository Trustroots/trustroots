// External dependencies
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import UserLink from './UserLink.component';
import UserState from './UserState.component';
import ZendeskInboxSearch from './ZendeskInboxSearch.component';
import { formatAdminDate, isSuspendedUser } from './userSearch.helpers';

export default function AdminUserResultsTable({
  showLimitWarning,
  showPublicProfileLink,
  showUserState,
  showZendeskActions,
  userResults,
  usersLimit,
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
              <th>Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Signed up</th>
            </tr>
          </thead>
          <tbody>
            {userResults.map(user => {
              const { _id, created, email, emailTemporary, username } = user;
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
