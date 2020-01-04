import React from 'react';
import PropTypes from 'prop-types';
import UserSummary from './UserSummary';

const mapUsers = (users) => users.map((user) => (
  <UserSummary
    className="contacts-contact"
    key={`user-results-${user.username}`}
    user={user}
  />
));

export default function UsersList({ users }) {
  const usersEven = [];
  const usersUnEven = [];
  for (let i = 0; i < users.length; i++) {
    if (i % 2 === 0) {
      usersEven.push(users[i]);
    }
    else {
      usersUnEven.push(users[i]);
    }
  }
  return (
    <div className="row">
      <div className="col-xs-12 col-sm-6">
        {mapUsers(usersEven)}
      </div>
      <div className="col-xs-12 col-sm-6">
        {mapUsers(usersUnEven)}
      </div>
    </div>
  );
}

UsersList.defaultProps = {
  users: [],
};

UsersList.propTypes = {
  users: PropTypes.array,
};
