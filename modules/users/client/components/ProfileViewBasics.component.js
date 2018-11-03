import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';

export default function ProfileViewBasics({ profile }) {
  return <>
    <div className="panel panel-default profile-overview">
      <div className="panel-body">
        <div className="profile-sidebar-section">
          Member since {moment(profile.created).format('MMM Do, YYYY')}
        </div>
        <div className="profile-sidebar-section">
          {profile.seen ? <span>Online {moment(profile.seen).fromNow()}</span> : <span>Online long ago</span>}
        </div>
      </div>
    </div>
  </>;
};

ProfileViewBasics.propTypes = {
  profile: PropTypes.object
};
