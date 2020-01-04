import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

// Internal dependencies
import UserSummary from './UserSummary';

export default function UsersList({ users }) {
  const UsersList = styled.div`
    display: grid;
    grid-gap: 0.75em;
  	grid-template-columns: 1fr;
    @media (min-width: 616px) {
  	   grid-template-columns: 1fr 1fr;
    }
  `;

  return (
    <UsersList>
      {users.map((user) => (
        <UserSummary
          className="user-summary"
          key={`user-${user.username}`}
          user={user}
        />
      ))}
    </UsersList>
  );
}

UsersList.propTypes = {
  users: PropTypes.array.isRequired,
};
