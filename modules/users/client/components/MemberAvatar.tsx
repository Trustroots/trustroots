import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import Avatar from './Avatar.component';
import type { UserProfile } from '../types';

type MemberAvatarUser = Pick<UserProfile, '_id' | 'username' | 'displayName'> &
  Pick<
    UserProfile,
    | 'avatarSource'
    | 'avatarUploaded'
    | 'avatarVersion'
    | 'updated'
    | 'emailHash'
    | 'additionalProvidersData'
  >;

const Fallback = styled.span<{ $size: number; $hue: number }>`
  display: inline-flex;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: ${({ $hue }) => `hsl(${$hue} 32% 91%)`};
  color: ${({ $hue }) => `hsl(${$hue} 38% 32%)`};
  font-size: ${({ $size }) => Math.max(14, Math.round($size * 0.34))}px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.02em;
  text-transform: uppercase;
`;

function hasProfileImage(user: MemberAvatarUser): boolean {
  switch (user.avatarSource) {
    case 'local':
      return Boolean(user.avatarUploaded && user._id);
    case 'facebook':
      return Boolean(user.additionalProvidersData?.facebook?.id);
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

  const fallback = (
    <Fallback
      aria-hidden="true"
      className="member-avatar-fallback"
      $hue={hueFor(user)}
      $size={size}
    >
      {initialsFor(user)}
    </Fallback>
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
