import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

// Internal dependencies
import UserSummary from './UserSummary';

const Container = styled.div`
  display: grid;
  grid-gap: 0.75em;
  grid-template-columns: 1fr;
  @media (min-width: 616px) {
    grid-template-columns: 1fr 1fr;
  }
`;

export default function UsersList({ users }) {
  return (
    <Container>
      {users.map(user => (
        <UserSummary key={`user-${user.username}`} user={user} />
      ))}
    </Container>
  );
}

UsersList.propTypes = {
  users: PropTypes.array.isRequired,
};
