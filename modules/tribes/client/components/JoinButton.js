import React, { useState } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { useTranslation } from 'react-i18next';

import LeaveTribeModal from './LeaveTribeModal';
import Tooltip from '@/modules/core/client/components/Tooltip';
import * as api from '../api/tribes.api';

function JoinButtonPresentational({
  icon = true,
  size = 'sm',
  style = 'default',
  isMember,
  isLoading,
  tribe,
  isLoggedIn,
  onToggle = () => {},
}) {
  const { t } = useTranslation('circles');

  const ariaLabel = isMember
    ? t('Leave circle')
    : t('Join ({{label}})', { label: tribe.label });
  const buttonLabel = isMember ? t('Joined') : t('Join');

  const className = classnames(
    'btn',
    `btn-${size}`,
    `btn-${style}`,
    'tribe-join',
    {
      'btn-active': isMember,
    },
  );

  // a button to be shown when user is signed out
  if (!isLoggedIn) {
    return (
      <a
        href={`/signup?tribe=${tribe.slug}`}
        type="button"
        className={className}
      >
        {icon && <i className="icon-plus" />}
        {buttonLabel}
      </a>
    );
  }

  return (
    <Tooltip
      tooltip={t('Leave circle')}
      placement="bottom"
      hidden={!isMember}
      id={`circle-${tribe._id}`}
    >
      <button
        type="button"
        className={className}
        disabled={isLoading}
        aria-label={ariaLabel}
        onClick={onToggle}
      >
        {icon && <i className={isMember ? 'icon-ok' : 'icon-plus'} />}
        {buttonLabel}
      </button>
    </Tooltip>
  );
}

JoinButtonPresentational.propTypes = {
  size: PropTypes.string,
  style: PropTypes.string,
  icon: PropTypes.bool,
  isMember: PropTypes.bool.isRequired,
  isLoading: PropTypes.bool,
  isLoggedIn: PropTypes.bool.isRequired,
  tribe: PropTypes.object.isRequired,
  onToggle: PropTypes.func,
};

// @TODO this can (and should) be replaced by other container, when we finish the migration; when we start using redux etc.
export default function JoinButton({
  tribe,
  user,
  onUpdated = () => {},
  style,
  size,
  icon,
  ...rest
}) {
  // isLeaving controls whether the modal for leaving a tribe is shown
  const [isLeaving, setIsLeaving] = useState(false);

  const [isUpdating, setIsUpdating] = useState(false);

  const isMemberInitial = (user?.memberIds || []).includes(tribe._id);
  const [isMember, setIsMember] = useState(isMemberInitial);

  /**
   * Handle joining or leaving of a tribe
   * - Join: join tribe immediately (api call)
   * - Leave: show confirmation modal
   */
  async function handleToggleMembership() {
    if (isUpdating) {
      return;
    }

    if (isMember) {
      setIsLeaving(true);
    } else {
      // updating starts
      setIsUpdating(true);

      // join
      const data = await api.join(tribe._id);
      // update the membership locally
      setIsMember(true);

      // updating finished
      setIsUpdating(false);
      // tell the ancestor components that the membership was updated
      onUpdated(data);
    }
  }

  /**
   * Leave a tribe (api call)
   */
  async function handleLeave() {
    setIsUpdating(true);
    const data = await api.leave(tribe._id);
    setIsUpdating(false);
    setIsLeaving(false);
    setIsMember(false);
    // tell the ancestor components that the membership was updated
    onUpdated(data);
  }

  function handleCancelLeave() {
    setIsLeaving(false);
  }

  return (
    <>
      <LeaveTribeModal
        show={isLeaving}
        tribe={tribe}
        onConfirm={handleLeave}
        onCancel={handleCancelLeave}
      />
      <JoinButtonPresentational
        tribe={tribe}
        isLoggedIn={!!user}
        isMember={isMember}
        isLoading={isUpdating}
        size={size}
        style={style}
        icon={icon}
        {...rest}
        onToggle={handleToggleMembership}
      />
    </>
  );
}

JoinButton.propTypes = {
  icon: PropTypes.bool,
  size: PropTypes.string,
  style: PropTypes.string,
  tribe: PropTypes.object.isRequired,
  user: PropTypes.object,
  onUpdated: PropTypes.func.isRequired,
};
