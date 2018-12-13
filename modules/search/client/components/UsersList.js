import React from 'react';
import PropTypes from 'prop-types';

const Avatar = ({ avatarSize, avatarSource, displayName, profileUrl }) => (
  <div data-size={avatarSize}>
    <a href={profileUrl}
      aria-label={`Open user profile for ${displayName}`}>
      <img className={`avatar avatar-${avatarSize} avatar-${avatarSource}`}
        alt=''
        // {alt={`Profile picture for ${userData.displayName}`}}
        aria-hidden="true"
        src={avatarSource}
        href={profileUrl}
        draggable="false" />
    </a>
  </div>
);

Avatar.defaultProps = {
  avatarSize: 128
};

Avatar.propTypes = {
  avatarSize: PropTypes.number,
  avatarSource: PropTypes.string,
  displayName: PropTypes.string,
  profileUrl: PropTypes.string
};

const User = ({ userData }) => {
  const profileUrl = `/profile/${userData.username}`;
  return (
    <div className="contacts-contact panel panel-default">
      <Avatar avatarSize={128} avatarSource="/test.html"
        displayName={userData.displayName}
        profileUrl={profileUrl}/>
      <h4>
        <a href={profileUrl}>
          {userData.displayName}
        </a>
      </h4>
      <div ng-if="::contactCtrl.contact.user.locationLiving">
        <i className="icon-fw icon-building text-muted"></i>
        <small>Lives in <a ui-sref="search.map({location: contactCtrl.contact.user.locationLiving})"
          ng-bind="::contactCtrl.contact.user.locationLiving"></a></small>
      </div>

      <div ng-if="::contactCtrl.contact.user.locationFrom">
        <i className="icon-fw icon-home text-muted"></i>
        <small>From <a ui-sref="search.map({location: contactCtrl.contact.user.locationFrom})"
          ng-bind="::contactCtrl.contact.user.locationFrom"></a></small>
      </div>

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
        <div className="col-xs-12 col-sm-6"
          ng-repeat="contact in ContactsList.contacts | filter:ContactsList.searchText track by contact._id">
          <div>
            {usersEvenComponent}
          </div>

        </div>

        <div className="col-xs-12 col-sm-6"
          ng-repeat="contact in ContactsList.contacts | filter:ContactsList.searchText track by contact._id">
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
