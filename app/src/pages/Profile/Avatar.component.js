import React from 'react';
import PropTypes from 'prop-types';
import has from 'lodash/has';
import '@/config/client/i18n';
import { useTranslation } from 'react-i18next';

/**
 * User's avatar
 * @param {object} user - User object
 * @param {integer=256} size - Size of the image <img>. Supported values are 2048, 1024, 512, 256, 128, 64, 36, 32, 24 and 16. See avatar.less for details. Defaults to 256.
 * @param {string=''} source - Leave empty to use user's selected source. Values "none", "facebook", "local", "gravatar".
 * @param {boolean=true} link - Include a link to user's profile. Defaults to true.
 */
export default function Avatar({
  user,
  size = 256,
  source = '',
  link = true,
  onClick,
}) {
  const { t } = useTranslation('users');

  source = source || user.avatarSource;
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
    <div onClick={onClick}>
      {link ? (
        <a
          href={`/profile/${user.username}`}
          aria-label={t('Open user profile for {{name}}', {
            name: user.displayName,
          })}
        >
          {img}
        </a>
      ) : (
        img
      )}
    </div>
  );
}

Avatar.propTypes = {
  user: PropTypes.object.isRequired,
  size: PropTypes.number,
  source: PropTypes.string,
  link: PropTypes.bool,
  onClick: PropTypes.func,
};

/**
 * Generate avatar url from facebook
 * @link https://developers.facebook.com/docs/graph-api/reference/user/picture/
 * @param {object} user - user object
 * @param {string} user.additionalProvidersData.facebook.id - user's facebook id
 * @param {number} size - size of the image
 * @returns {string} - the url
 */
function facebookAvatarUrl(user, size) {
  const isValid = has(user, 'additionalProvidersData.facebook.id');

  return (
    isValid &&
    `https://graph.facebook.com/${user.additionalProvidersData.facebook.id}/picture/?width=${size}&height=${size}`
  );
}

/**
 * Generate url to avatar image that user uploaded
 * @param {object} user - user object
 * @param {number} size - size of the image
 * @returns {string} - the url
 */
function localAvatarUrl(user, size) {
  const isValid = user && user.avatarUploaded && user._id;

  if (isValid) {
    // Cache buster
    const timestamp = user.updated ? new Date(user.updated).getTime() : '';
    // 32 is the smallest and 2048 biggest file size we're generating.
    const fileSize = Math.min(Math.max(size, 32), 2048);

    return `/uploads-profile/${user._id}/avatar/${fileSize}.jpg?${timestamp}`;
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
function gravatarUrl(user, size, defaultAvatar) {
  const isValid = user.emailHash;

  // This fallback image won't work via localhost since Gravatar fallback is required to be online.
  // @TODO use config to set the location. (host, port & protocol should be provided from config)
  const fallbackImage = `https://trustroots.org${defaultAvatar}`;

  return (
    isValid &&
    `https://gravatar.com/avatar/${
      user.emailHash
    }?s=${size}&d=${encodeURIComponent(fallbackImage)}`
  );
}

/**
 * Generate avatar url
 * @param {object} user - user object
 * @param {integer} size - size of the image. Supported values are 2048, 1024, 512, 256, 128, 64, 36, 32, 24, 16.
 * @param {string} source - avatar source. One of ['' (user's selected source), 'none', 'facebook', 'gravatar', 'local']
 * @param {string} defaultAvatar - url to a default avatar
 * @returns {string} - the url
 */
function avatarUrl(user, source, size, defaultAvatar) {
  return (
    (source === 'local' && localAvatarUrl(user, size)) ||
    (source === 'gravatar' && gravatarUrl(user, size, defaultAvatar)) ||
    (source === 'facebook' && facebookAvatarUrl(user, size)) ||
    `${defaultAvatar}?none`
  );
}
