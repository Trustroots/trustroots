// External dependencies
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

// Internal dependencies
import Avatar from '@/modules/users/client/components/Avatar.component';

const Container = styled.div.attrs({
  className: 'panel panel-default',
})`
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

export default function UserSummary({ user }) {
  return (
    <Container>
      <Avatar link size={128} user={user} />
      <h4>
        <a href={`/profile/${user.username}`}>{user.displayName}</a>
      </h4>
    </Container>
  );
}

UserSummary.propTypes = {
  user: PropTypes.object.isRequired,
};
