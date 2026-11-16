import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import Avatar from './Avatar.component';
import type { UserProfile } from '../types';

type MemberAvatarUser = Partial<
  Pick<
    UserProfile,
    | '_id'
    | 'username'
    | 'displayName'
    | 'avatarSource'
    | 'avatarUploaded'
    | 'avatarVersion'
    | 'updated'
    | 'emailHash'
  >
>;

function hasProfileImage(user: MemberAvatarUser): boolean {
  switch (user.avatarSource) {
    case 'local':
      return Boolean(user.avatarUploaded && user._id);
    case 'gravatar':
      return Boolean(user.emailHash);
    default:
      return false;
  }
}

function initialsFor(user: MemberAvatarUser): string {
  const name = user.displayName?.trim() || user.username?.trim() || '?';
  const parts = name.split(/\s+/).filter(Boolean);
  return (
    parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`
      : name.slice(0, 2)
  ).toUpperCase();
}

function hueFor(user: MemberAvatarUser): number {
  const seed = user.username || user._id || user.displayName || 'member';
  const hash = Array.from(seed).reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) % 360,
    0,
  );
  return 105 + (hash % 55);
}

export default function MemberAvatar({
  user,
  size = 64,
  link = false,
}: {
  user: MemberAvatarUser;
  size?: number;
  link?: boolean;
}) {
  const { t } = useTranslation('users');
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const imageKey = `${user._id}|${user.avatarSource}|${user.avatarVersion}|${user.updated}`;
  if (hasProfileImage(user) && failedImage !== imageKey) {
    return (
      <div
        className="member-avatar"
        style={{ width: size, flexShrink: 0 }}
        onErrorCapture={() => setFailedImage(imageKey)}
      >
        <Avatar user={user} size={size} link={link} />
      </div>
    );
  }

  const hue = hueFor(user);
  const fallback = (
    <span
      aria-hidden="true"
      className="member-avatar-fallback tw:inline-flex tw:flex-[0_0_auto] tw:items-center tw:justify-center tw:rounded-full tw:font-semibold tw:leading-none tw:tracking-[0.02em] tw:uppercase"
      style={{
        width: size,
        height: size,
        background: `hsl(${hue} 32% 91%)`,
        color: `hsl(${hue} 38% 32%)`,
        fontSize: Math.max(14, Math.round(size * 0.34)),
      }}
    >
      {initialsFor(user)}
    </span>
  );

  return link && user.username ? (
    <a
      href={`/profile/${encodeURIComponent(user.username)}`}
      aria-label={String(
        t('Open user profile for {{name}}', {
          name: user.displayName || user.username,
        }),
      )}
    >
      {fallback}
    </a>
  ) : (
    fallback
  );
}
