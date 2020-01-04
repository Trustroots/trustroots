import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Avatar from '@/modules/users/client/components/Avatar.component';

export default function UserSummary({ className, user }) {
  return (
    <div className={ classNames(className, 'panel panel-default') }>
      <Avatar
        link
        size={128}
        user={user}
      />
      <h4>
        <a href={`/profile/${user.username}`}>
          {user.displayName}
        </a>
      </h4>
    </div>
  );
}

UserSummary.propTypes = {
  className: PropTypes.string,
  user: PropTypes.object
};
