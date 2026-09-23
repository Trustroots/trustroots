/**
 * A panel with basic user info in user profile.
 * It wraps Avatar, a Modal with Avatar and ProfileViewBasics components.
 * @param {Object} profile - displayed user's profile data
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Avatar from './Avatar.component';
import ProfileViewBasics from './ProfileViewBasics';
import { Modal } from 'react-bootstrap';
import { QueryClient, QueryClientProvider } from 'react-query';

const queryClient = new QueryClient();

export default function ProfileOverview({ profile, isSelf }) {
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const showPhotoEditLink =
    isSelf && (!profile.avatarUploaded || profile.avatarSource === 'none');

  const handleClose = () => setIsAvatarModalOpen(false);

  return (
    <QueryClientProvider client={queryClient}>
      {/* panel with avatar and basic info */}
      <div className="panel panel-default profile-overview">
        {/* avatar */}
        <a
          className={`hidden-xs${
            showPhotoEditLink ? ' profile-photo-edit-link' : ''
          }`}
          href={showPhotoEditLink ? '/profile/edit/photo' : undefined}
          aria-label={showPhotoEditLink ? 'Edit profile photo' : undefined}
          aria-hidden={showPhotoEditLink ? undefined : true}
          onClick={
            showPhotoEditLink ? undefined : () => setIsAvatarModalOpen(true)
          }
        >
          <Avatar user={profile} size={256} link={false} />
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
        onHide={handleClose}
        className="modal-avatar"
      >
        <Avatar user={profile} size={512} link={false} onClick={handleClose} />
      </Modal>
    </QueryClientProvider>
  );
}

ProfileOverview.propTypes = {
  profile: PropTypes.object.isRequired,
  isSelf: PropTypes.bool,
};
