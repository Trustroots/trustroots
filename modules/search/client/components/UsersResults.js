import React from 'react';
import PropTypes from 'prop-types';
import UsersList from './UsersList';
import NoContent from '@/modules/core/client/components/NoContent';

export default function UsersResults({ users }) {
  if (!users || users.length === 0) {
    return (
      <NoContent icon="users" message="No members found by this name." />
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
