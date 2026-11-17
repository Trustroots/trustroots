/**
 * The AvatarNameMobile component displays user's avatar, name, username and tagline.
 * @param {Object} profile - the user's profile
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import Avatar from './Avatar.component';
import MemberIdentity from './MemberIdentity';
import type { UserProfile } from '../types';

export default function AvatarNameMobile({
  profile,
  isSelf = false,
}: {
  profile: UserProfile & { displayUsername?: string };
  isSelf?: boolean;
}) {
  const [isBiggerAvatar, setIsBiggerAvatar] = useState(false);
  const { t } = useTranslation('users');
  const showPhotoEditLink =
    isSelf && (!profile.avatarUploaded || profile.avatarSource === 'none');

  return (
    <div className="visible-xs-block">
      <MemberIdentity
        user={{
          ...profile,
          username: profile.displayUsername || profile.username,
        }}
        size={64}
        className="tw:mb-2 tw:text-xl"
        heading
        renderAvatar={avatar =>
          showPhotoEditLink ? (
            <a href="/profile/edit/photo" aria-label="Edit profile photo">
              {avatar}
            </a>
          ) : (
            <button
              type="button"
              className="tw:shrink-0 tw:cursor-zoom-in tw:border-0 tw:bg-transparent tw:p-0"
              aria-label={t('Open profile picture of {{name}}', {
                name: profile.displayName || profile.username,
              })}
              aria-expanded={isBiggerAvatar}
              onClick={() => setIsBiggerAvatar(open => !open)}
            >
              {avatar}
            </button>
          )
        }
      />
      {isBiggerAvatar && (
        <div className="profile-avatar-lg">
          <Avatar user={profile} size={512} link={false} />
        </div>
      )}
      {profile.tagline && <p className="profile-tagline">{profile.tagline}</p>}
    </div>
  );
}
