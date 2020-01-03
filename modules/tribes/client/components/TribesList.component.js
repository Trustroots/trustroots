import React from 'react';
import PropTypes from 'prop-types';

import styled from 'styled-components';

import Tribe from './Tribe';
import SuggestTribe from './SuggestTribe';

const List = styled.ul`
  margin: -5px -5px 15px -5px;
`;

const Item = styled.li`
  padding: 5px;
  display: inline-block;
  vertical-align: bottom;

  // on small screens there is just one column of tribes
  width: 100%;

  @media (min-width: 616px) {
    // two columns of tribes
    width: 50%;
  }

  @media (min-width: 992px) {
    // three columns of tribes
    width: 33.3333%;
  }
`;

export default function TribesList({ tribes, user, onMembershipUpdated }) {
  return (
    <List className="list-unstyled tribes-grid">
      {tribes.map(tribe => (
        <Item key={tribe._id}>
          <Tribe
            tribe={tribe}
            user={user}
            onMembershipUpdated={onMembershipUpdated}
          />
        </Item>
      ))}
      <Item>
        <SuggestTribe />
      </Item>
    </List>
  );
}

TribesList.propTypes = {
  tribes: PropTypes.array.isRequired,
  user: PropTypes.object,
  onMembershipUpdated: PropTypes.func.isRequired
};
