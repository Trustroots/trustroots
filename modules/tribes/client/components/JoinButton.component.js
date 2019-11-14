import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import * as api from '../api/tribes.api';

function JoinButtonPresentational({ isMember, onToggle, isLoading, joinLabel='Join', joinedLabel='Joined', tribe, isLogged }) {
  const { t } = useTranslation('tribes');

  const ariaLabel = (isMember) ? t('Leave Tribe') : t(`${joinLabel} ({{label}})`, { label: tribe.label });
  const title = (isMember) ? t(joinedLabel) : t(joinLabel);

  if (!isLogged) {
    return <a
      href={`/signup?tribe=${tribe.slug}`}
      type="button"
      className="btn btn-sm btn-default tribe-join"
    >
      <i className="icon-plus" /> {title}
    </a>;
  }

  return <button
    type="button"
    className={`${isMember ? 'btn-active' : ''} btn btn-sm btn-default tribe-join`}
    onClick={onToggle}
    disabled={isLoading}
    aria-label={ariaLabel}
  >
    <i className={(isMember) ? 'icon-ok' : 'icon-plus'} /> {title}
  </button>;
}

JoinButtonPresentational.propTypes = {
  isMember: PropTypes.bool.isRequired,
  onToggle: PropTypes.func,
  isLoading: PropTypes.bool,
  joinLabel: PropTypes.string,
  joinedLabel: PropTypes.string,
  tribe: PropTypes.object.isRequired,
  isLogged: PropTypes.object.isRequired
};

// @TODO this can (and should) be replaced by other container, when we finish the migration; when we start using redux etc.
export default function JoinButton({ tribe, user, isLoading, ...rest }) {
  const isMember = user && user.memberIds && user.memberIds.indexOf(tribe._id) > -1;

  const [isUpdating, setIsUpdating] = useState(false);
  const [_isMember, _setIsMember] = useState(isMember);

  async function handleToggleMembership() {
    if (isLoading || isUpdating) {
      return;
    }

    // updating starts
    setIsUpdating(true);

    // join or leave
    const joinOrLeave = (_isMember) ? api.leave : api.join;
    await joinOrLeave(tribe._id);
    // update the membership locally
    _setIsMember(_isMember => !_isMember);

    // updating finished
    setIsUpdating(false);
  }

  return <JoinButtonPresentational tribe={tribe} isLogged={!!user} isMember={_isMember} isLoading={isLoading || isUpdating} {...rest} onToggle={handleToggleMembership} />;
}

JoinButton.propTypes = {
  isLoading: PropTypes.bool.isRequired,
  tribe: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired
};
