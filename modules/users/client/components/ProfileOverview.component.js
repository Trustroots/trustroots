/**
 * A panel with basic user info in user profile.
 * It wraps Avatar, a Modal with Avatar and ProfileViewBasics components.
 * @param {Object} profile - displayed user's profile data
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Avatar from './Avatar.component';
import ProfileViewBasics from './ProfileViewBasics.component';
import { Modal } from 'react-bootstrap';

export default function ProfileOverview({ profile }) {
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  return (<>
    {/* panel with avatar and basic info */}
    <div className="panel panel-default profile-overview">
      {/* avatar */}
      <a
        className="hidden-xs"
        aria-hidden={true}
        onClick={() => setIsAvatarModalOpen(true)}
      >
        <Avatar
          user={profile}
          size={256}
          link={false}
        />
      </a>

      {/* basic info panel */}
      <div className="panel-body">
        <div className="profile-sidebar-section">
          <ProfileViewBasics profile={profile} />
        </div>
      </div>
    </div>

    {/* modal with avatar */}
    <Modal
      show={isAvatarModalOpen}
      onHide={() => setIsAvatarModalOpen(false)}
      className="modal-avatar"
    >
      <Avatar
        user={profile}
        size={512}
        link={false}
      />
    </Modal>
  </>);
}

ProfileOverview.propTypes = {
  profile: PropTypes.object.isRequired
};
