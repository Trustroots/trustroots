import React from 'react';
import PropTypes from 'prop-types';

import styled from 'styled-components';

import Tribe from './Tribe';
import SuggestTribe from './SuggestTribe';

const List = styled.ul`
  margin: -5px -5px 15px -5px;
  line-height: 0;
`;

const Item = styled.li`
  line-height: 1.42857143; // set back the line-height set by bootstrap
  padding: 5px;
  display: inline-block;
  vertical-align: bottom;
  // background-color: red;
  @media (max-width: 615.9999px) {
    width: 100%;
  }

  @media (min-width: 616px) and (max-width: 991.9999px) {
    width: 50%;
  }

  @media (min-width: 992px) {
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
