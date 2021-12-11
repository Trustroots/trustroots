import PropTypes from 'prop-types';
import React from 'react';

import * as api from '../api/block.api';
import Icon from '../../components/Icon';

export default function BlockMember({ username, isBlocked, className }) {

  function refreshUser() {
    // Refresh the page to reset global `window.app.user`
    // Once we have global state handler and whole user profile is in React, we can remove this.
    window.location.reload();
  }

  // Unblock member
  async function handleUnBlockMember(username) {
    const confirmation = window.confirm(
      "Are you sure you want to unblock them? They will be able to see your profile and message you again.Are you sure you want to unblock them? They will be able to see your profile and messaage you again."
    );

    if (confirmation) {
      const response = await api.unblock(username);

      if (response) {
        refreshUser();
      } else {
        window.alert(
          "Could not unblock this member.\n\nPlease ensure you are connected to internet and try again."
        );
      }
    }
  }

  // Block member
  async function handleBlockMember(username) {
    const confirmation = window.confirm(
      "Are you sure you want to block them? They will not be able to see or message you."
    );

    if (confirmation) {
      const response = await api.block(username);

      if (response) {
        refreshUser();
      } else {
        alert(
            "Could not block this member.\n\nPlease ensure you are connected to internet and try again."
        );
      }
    }
  }

  if (isBlocked) {
    return (
      <button
        className={className}
        aria-label={`Unblock member ${username}`}
        onClick={() => handleUnBlockMember(username)}
      >
        <Icon icon="invalid" />
        Unblock member
      </button>
    );
  }

  return (
    <button
      className={className}
      aria-label={`Block member ${username}`}
      onClick={() => handleBlockMember(username)}
    >
      <Icon icon="invalid" />
      Block member
    </button>
  );
}

BlockMember.propTypes = {
  isBlocked: PropTypes.bool,
  className: PropTypes.string,
  username: PropTypes.string.isRequired,
};
