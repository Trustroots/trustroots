// External dependencies
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

// Internal dependencies
import Avatar from '@/modules/users/client/components/Avatar.component';

export default function UserSummary({ user }) {
  const UserSummary = styled.div`
    margin: 0;
    overflow: hidden;
    .avatar {
      border-radius: 0;
      float: left;
      margin: 0 10px 0 0;
    }
    h4 {
      margin-left: 5px;
      margin-right: 5px;
      a {
        text-decoration: none;
      }
    }
  `;

  return (
    <UserSummary className="panel panel-default">
      <Avatar link size={128} user={user} />
      <h4>
        <a href={`/profile/${user.username}`}>
          {user.displayName}
        </a>
      </h4>
    </UserSummary>
  );
}

UserSummary.propTypes = {
  user: PropTypes.object.isRequired
};
