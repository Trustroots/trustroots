/**
 * A panel with basic user info in user profile.
 * It wraps Avatar, a Modal with Avatar and ProfileViewBasics components.
 * @param {Object} profile - displayed user's profile data
 */

import React, { useState } from 'react';
import Avatar from './Avatar.component';
import ProfileViewBasics from './ProfileViewBasics';
import { Modal } from '@trustroots/ui/Modal';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { UserProfile } from '../types';

const queryClient = new QueryClient();

export default function ProfileOverview({
  profile,
  isSelf,
}: {
  profile: UserProfile;
  isSelf: boolean;
}) {
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const { t } = useTranslation('users');
  const showPhotoEditLink =
    isSelf && (!profile.avatarUploaded || profile.avatarSource === 'none');

  const handleClose = () => setIsAvatarModalOpen(false);

  return (
    <QueryClientProvider client={queryClient}>
      {/* panel with avatar and basic info */}
      <div className="panel panel-default profile-overview">
        {/* avatar */}
        {showPhotoEditLink ? (
          <a
            className="tw:max-sm:hidden profile-photo-edit-link"
            href="/profile/edit/photo"
            aria-label="Edit profile photo"
          >
            <Avatar user={profile} size={256} link={false} />
          </a>
        ) : (
          <button
            className="tw:max-sm:hidden tw:block tw:w-full tw:border-0 tw:bg-transparent tw:p-0"
            type="button"
            aria-label={t('Open profile picture of {{name}}', {
              name: profile.displayName || profile.username,
            })}
            onClick={() => setIsAvatarModalOpen(true)}
          >
            <Avatar user={profile} size={256} link={false} />
          </button>
        )}

        {/* basic info panel */}
        <div className="panel-body">
          <div className="profile-sidebar-section">
            <ProfileViewBasics profile={profile} />
          </div>
        </div>
      </div>

      {/* modal with avatar */}
      <Modal
        open={isAvatarModalOpen}
        onClose={handleClose}
        className="modal-avatar"
      >
        <Avatar user={profile} size={512} link={false} onClick={handleClose} />
      </Modal>
    </QueryClientProvider>
  );
}
