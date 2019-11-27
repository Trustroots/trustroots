import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import LeaveTribeModal from './LeaveTribeModal';

import * as api from '../api/tribes.api';

function JoinButtonPresentational({ isMember, isLoading, joinLabel='Join', joinedLabel='Joined', tribe, isLogged, onToggle }) {
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
  isLoading: PropTypes.bool,
  isLogged: PropTypes.bool.isRequired,
  joinLabel: PropTypes.string,
  joinedLabel: PropTypes.string,
  tribe: PropTypes.object.isRequired,
  onToggle: PropTypes.func
};

// @TODO this can (and should) be replaced by other container, when we finish the migration; when we start using redux etc.
// @TODO onUpdated is required by angular only; to broadcast the changes to $rootScope. Remove!
export default function JoinButton({ tribe, user, onUpdated, ...rest }) {
  const isMember = user && user.memberIds && user.memberIds.indexOf(tribe._id) > -1;

  // isLeaving controls whether the tribe delete modal is shown
  const [isLeaving, setIsLeaving] = useState(false);

  const [isUpdating, setIsUpdating] = useState(false);
  const [_isMember, _setIsMember] = useState(isMember);

  async function handleToggleMembership() {
    if (isUpdating) {
      return;
    }

    if (_isMember) {
      setIsLeaving(true);
    } else {
      // updating starts
      setIsUpdating(true);

      // join
      const data = await api.join(tribe._id);
      // update the membership locally
      _setIsMember(true);

      // updating finished
      setIsUpdating(false);
      onUpdated(data);
    }
  }

  async function handleLeave() {
    setIsUpdating(true);
    const data = await api.leave(tribe._id);
    setIsUpdating(false);
    setIsLeaving(false);
    _setIsMember(false);
    onUpdated(data);
  }

  function handleCancelLeave() {
    setIsLeaving(false);
  }

  return <>
    <LeaveTribeModal show={isLeaving} tribe={tribe} onConfirm={handleLeave} onCancel={handleCancelLeave}/>
    <JoinButtonPresentational tribe={tribe} isLogged={!!user} isMember={_isMember} isLoading={isUpdating} {...rest} onToggle={handleToggleMembership} />
  </>;
}

JoinButton.propTypes = {
  tribe: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  onUpdated: PropTypes.func.isRequired
};
