// External dependencies
import React from 'react';
import PropTypes from 'prop-types';
import { showUserRoles } from './AdminSearchUsers.component.js';

export default function AdminUserPreview({ user }) {
  return (
    <div className="panel panel-default">
      <div className="panel-body">
        { showUserRoles(user.roles) }
        <pre>{ JSON.stringify(user, null, 2) }</pre>
      </div>
    </div>
  );
}

AdminUserPreview.propTypes = {
  user: PropTypes.object.isRequired
};
