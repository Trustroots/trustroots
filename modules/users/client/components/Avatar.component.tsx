import React from 'react';
import { Button } from '@trustroots/ui/Button';
import '@/config/client/i18n';
import { useTranslation } from 'react-i18next';

type AvatarUser = {
  username?: string | null;
  _id?: string;
  displayName?: string | null;
  avatarSource?: string;
  avatarUploaded?: boolean;
  avatarVersion?: string;
  updated?: string;
  emailHash?: string;
};

interface AvatarProps {
  user: AvatarUser;
  size?: number;
  source?: string;
  link?: boolean;
  onClick?: React.MouseEventHandler<HTMLElement>;
}

/**
 * User's avatar
 * @param {object} user - User object
 * @param {integer=256} size - Size of the image <img>. Supported values are 2048, 1024, 512, 256, 128, 64, 36, 32, 24 and 16. See avatar.less for details. Defaults to 256.
 * @param {string=''} source - Leave empty to use user's selected source. Values "none", "local", "gravatar".
 * @param {boolean=true} link - Include a link to user's profile. Defaults to true.
 */
export default function Avatar({
  user,
  size = 256,
  source = '',
  link = true,
  onClick,
}: AvatarProps) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  source = source || user.avatarSource || '';
  if (source === 'facebook') source = 'none';
  const defaultAvatar = '/img/avatar.png';

  const avatar = avatarUrl(user, source, size, defaultAvatar);

  const img = (
    <img
      className={`avatar avatar-${size} avatar-${source}`}
      alt={
        '' /* t('Profile picture of {{name}}', { name: user.displayName }) */
      }
      aria-hidden="true"
      src={avatar}
      draggable="false"
    />
  );

  return (
    <div>
      {link ? (
        <a
          href={`/profile/${user.username}`}
          onClick={onClick}
          aria-label={t('Open user profile for {{name}}', {
            name: user.displayName || user.username,
          })}
        >
          {img}
        </a>
      ) : onClick ? (
        <Button
          type="button"
          variant="link"
          aria-label={t('Open profile picture of {{name}}', {
            name: user.displayName || user.username,
          })}
          onClick={onClick}
        >
          {img}
        </Button>
      ) : (
        img
      )}
    </div>
  );
}

/**
 * Generate url to avatar image that user uploaded
 * @param {object} user - user object
 * @param {number} size - size of the image
 * @returns {string} - the url
 */
function localAvatarUrl(user: AvatarUser, size: number): string | undefined {
  const isValid = user && user.avatarUploaded && user._id;

  if (isValid) {
    // Cache buster
    const timestamp = user.updated ? new Date(user.updated).getTime() : '';
    // We only generate profile images at 32, 64, 128, 256, 512, 1024 and 2048
    // pixels. Other sizes will return a 404. There should be some kind of
    // config value somewhere that sets which sizes are generated. But for now,
    // hacking this to only return valid URLs.
    const validSizes = [32, 64, 128, 256, 512, 1024, 2048];
    // Pick the first valid size which is equal to or greater than the target,
    // and fall back on the largest size if that fails.
    const fileSize =
      validSizes.find(validSize => validSize === size || validSize > size) ||
      2048;

    const version = /^[a-f0-9]{32}$/.test(user.avatarVersion || '')
      ? `${user.avatarVersion}/`
      : '';

    return `/uploads-profile/${user._id}/avatar/${version}${fileSize}.jpg?${timestamp}`;
  }
}

/**
 * Generate avatar url from Gravatar
 * @link https://en.gravatar.com/site/implement/images/
 * @param {object} user - user object
 * @param {string} user.emailHash - gravatar identifies users by their email hashes
 * @param {number} size - size of the image
 * @returns {string} - the url
 *
 * @todo fallback image is provided from trustroots.org; it should rather come from config
 */
function gravatarUrl(
  user: AvatarUser,
  size: number,
  defaultAvatar: string,
): string | false {
  const isValid = user.emailHash;

  // This fallback image won't work via localhost since Gravatar fallback is required to be online.
  // @TODO use config to set the location. (host, port & protocol should be provided from config)
  const fallbackImage = `https://trustroots.org${defaultAvatar}`;

  return (
    (isValid &&
      `https://gravatar.com/avatar/${
        user.emailHash
      }?s=${size}&d=${encodeURIComponent(fallbackImage)}`) ||
    false
  );
}

/**
 * Generate avatar url
 * @param {object} user - user object
 * @param {integer} size - size of the image. Supported values are 2048, 1024, 512, 256, 128, 64, 36, 32, 24, 16.
 * @param {string} source - avatar source. One of ['' (user's selected source), 'none', 'gravatar', 'local']
 * @param {string} defaultAvatar - url to a default avatar
 * @returns {string} - the url
 */
function avatarUrl(
  user: AvatarUser,
  source: string,
  size: number,
  defaultAvatar: string,
): string {
  return (
    (source === 'local' && localAvatarUrl(user, size)) ||
    (source === 'gravatar' && gravatarUrl(user, size, defaultAvatar)) ||
    `${defaultAvatar}?none`
  );
}
