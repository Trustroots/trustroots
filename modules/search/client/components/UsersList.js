import React from 'react';
import PropTypes from 'prop-types';

const Avatar = ({ avatarSize, avatarSource, userData }) => (
  <div data-size={avatarSize}>
    <a href={userData.profileUrl}
      aria-label={`Open user profile for ${userData.displayName}`}>
      <img className={`avatar avatar-${avatarSize} avatar-${avatarSource}`}
        alt=''
        // {alt={`Profile picture for ${userData.displayName}`}}
        aria-hidden="true"
        src={avatarSource}
        href={userData.profileUrl}
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
  userData: PropTypes.object
};

const User = ({ userData }) => (
  <div className="contacts-contact panel panel-default">
    <Avatar avatarSize={128} avatarSource="/test.html" userData={userData}/>
    <h4>
      <a href="profile.about({username: contactCtrl.contact.user.username})">
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

  // tr-contact-profile-id="::profileCtrl.profile._id"
  // tr-contact="::contact"></div>
);

User.propTypes = {
  userData: PropTypes.object
};


export default function UsersList({ users }) {
  const usersComponent = [];
  for (const user of users) {
    usersComponent.push(<User userData={user} />);
  }
  return (
    <div>
      <div className="row">
        <div className="col-xs-12 col-sm-6"
          ng-repeat="contact in ContactsList.contacts | filter:ContactsList.searchText track by contact._id">
          <div>
            {<User userData={users[0]} />}
          </div>

        </div>
      </div>

      <div className="row">
        <div className="col-xs-12 col-sm-6"
          ng-repeat="contact in ContactsList.contacts | filter:ContactsList.searchText track by contact._id">
          <div>
            {<User userData={users[1]} />}
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
