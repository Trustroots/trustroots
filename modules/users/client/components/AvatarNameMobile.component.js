/**
 * The AvatarNameMobile component displays user's avatar, name, username and tagline.
 * @param {Object} profile - the user's profile
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import Avatar from './Avatar.component';

export default function AvatarNameMobile({ profile }) {
  const [isBiggerAvatar, setIsBiggerAvatar] = useState(false);

  return (
    <div className="text-center visible-xs-block" role="dialog">

      {/* Avatar */}
      <a
        onClick={() => setIsBiggerAvatar(!isBiggerAvatar)}
        className={classNames('visible-xs-block', 'avatar-circle', { 'profile-avatar-lg': isBiggerAvatar })}
        aria-hidden={true}>
        <Avatar
          user={profile}
          size={512}
          link={false}
        />
      </a>

      {/* Name */}
      {profile.displayName && <h2 className="profile-name">{profile.displayName}</h2>}

      <br />

      {/* Username */}
      <h4 className="profile-username">
        @{profile.displayUsername || profile.username}
      </h4>

      <br />

      {/* Tagline */}
      {profile.tagline && <p className="profile-tagline">{profile.tagline}</p>}

    </div>
  );
}

AvatarNameMobile.propTypes = {
  profile: PropTypes.object.isRequired
};
