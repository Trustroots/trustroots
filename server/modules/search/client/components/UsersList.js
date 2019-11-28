import React from 'react';
import PropTypes from 'prop-types';

import Avatar from '@/modules/users/client/components/Avatar.component';

const User = ({ userData }) => {
  const profileUrl = `/profile/${userData.username}`;
  return (
    <div className="contacts-contact panel panel-default">
      <Avatar size={128}
        user={userData}
        link={true}/>
      <h4>
        <a href={profileUrl}>
          {userData.displayName}
        </a>
      </h4>
    </div>
  );
};

User.propTypes = {
  userData: PropTypes.object
};


export default function UsersList({ users }) {
  const usersEvenComponent = [];
  const usersUnEvenComponent = [];
  for (let i = 0; i < users.length; i++) {
    if (i % 2 === 0) {
      usersEvenComponent.push(<User userData={users[i]} key={`user-results-${i}`} />);
    }
    else {
      usersUnEvenComponent.push(<User userData={users[i]} key={`user-results-${i}`} />);
    }
  }
  return (
    <div>
      <div className="row">
        <div className="col-xs-12 col-sm-6">
          <div>
            {usersEvenComponent}
          </div>

        </div>

        <div className="col-xs-12 col-sm-6">
          <div>
            {usersUnEvenComponent}
          </div>

        </div>
      </div>
    </div>
  );
}

UsersList.defaultProps = {
  users: []
};

UsersList.propTypes = {
  users: PropTypes.array
};
