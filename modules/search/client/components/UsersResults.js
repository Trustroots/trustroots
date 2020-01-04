import React from 'react';
import PropTypes from 'prop-types';
import UsersList from './UsersList';

export default function UsersResults({ users }) {
  if (!users || users.length === 0) {
    return (
      <div className="row content-empty">
        <i className="icon-3x icon-users"></i>
        <h4>No members found by this name.</h4>
      </div>
    );
  }

  return (
    <div className="contacts-list">
      <div className="row">
        <div className="col-xs-12">
          <h4 className="text-muted">
            {users.length === 1 && <p>One member found.</p>}
            {users.length > 1 && <p>{users.length} members found.</p>}
            <UsersList users={users}/>
          </h4>
        </div>
      </div>
    </div>
  );
}

UsersResults.propTypes = {
  users: PropTypes.array
};
