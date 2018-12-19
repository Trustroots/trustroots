import React from 'react';
import PropTypes from 'prop-types';
import has from 'lodash/has';
import '@/config/lib/i18n';
import { withNamespaces } from 'react-i18next';

export function Avatar({ t, user, size=256, source='', link=true }) {

  source = source || user.avatarSource;
  const defaultAvatar = '/img/avatar.png';

  const avatar = avatarUrl(user, source, size, defaultAvatar);

  const img = (
    <img className={`avatar avatar-${size} avatar-${source}`}
      alt={''/* t('Profile picture of {{name}}', { name: user.displayName }) */}
      aria-hidden="true"
      src={avatar}
      draggable="false"
    />
  );

  return (
    <div>{
      (link)
        ?
        <a
          href={`/profile/${user.username}`}
          aria-label={t('Open user profile for {{name}}', { name: user.displayName })}
        >{img}</a>
        :
        img
    }</div>
  );
}

const AvatarHOC = withNamespaces('user')(Avatar);

AvatarHOC.propTypes = {
  user: PropTypes.object.isRequired,
  size: PropTypes.number,
  source: PropTypes.string,
  link: PropTypes.bool
};

Avatar.propTypes = {
  ...AvatarHOC.propTypes,
  t: PropTypes.func.isRequired
};

Object.defineProperty(AvatarHOC, 'name', { value: 'Avatar' });

export default AvatarHOC;


// Avatar via FB
// @link https://developers.facebook.com/docs/graph-api/reference/user/picture/
function facebookAvatarUrl(user, size) {
  const isValid = has(user, 'additionalProvidersData.facebook.id');

  return isValid && `https://graph.facebook.com/${user.additionalProvidersData.facebook.id}/picture/?width=${size}&height=${size}`;
}

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

// Avatar via Gravatar
// @link https://en.gravatar.com/site/implement/images/
function gravatarUrl(user, size, defaultAvatar) {
  const isValid = user.emailHash;

  // This fallback image won't work via localhost since Gravatar fallback is required to be online.
  // @TODO use config to set the location. (host, port & protocol should be provided from config)
  const fallbackImage = `https://trustroots.org${defaultAvatar}`;

  return isValid && `https://gravatar.com/avatar/${user.emailHash}?s=${size}&d=${encodeURIComponent(fallbackImage)}`;
}

function avatarUrl(user, source, size, defaultAvatar) {
  return (source === 'local' && localAvatarUrl(user, size))
    || (source === 'gravatar' && gravatarUrl(user, size, defaultAvatar))
    || (source === 'facebook' && facebookAvatarUrl(user, size))
    || `${defaultAvatar}?none`;
}

/**
 * @param {object} user User object
 * @param {int} size Size of the image <img>. Supported values are 2048, 1024, 512, 256, 128, 64, 36, 32, 24 and 16. See avatar.less for details. Defaults to 256.
 * @param {string} source Leave empty to use user's selected source. Values "none", "facebook", "local", "gravatar".
 * @param {boolean} link Link to user's profile. Defaults to true.
 */
