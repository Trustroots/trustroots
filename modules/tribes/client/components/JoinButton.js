import React, { useState } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { useTranslation } from 'react-i18next';

import LeaveTribeModal from './LeaveTribeModal';
import Tooltip from '@/modules/core/client/components/Tooltip';
import * as api from '../api/tribes.api';

export default function JoinButton({
  tribe,
  user,
  onUpdated = () => {},
  style = 'default',
  size = 'sm',
  icon = true,
  ...rest
}) {
  const { t } = useTranslation('circles');

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
    // Just redirect to signup if not logged in
    if (!user) {
      window.location = `/signup?tribe=${tribe.slug}`;
    }

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
      <Tooltip
        tooltip={t('Leave circle')}
        placement="bottom"
        hidden={!isMember}
        id={`tooltip-circle-${tribe._id}`}
      >
        <button
          type="button"
          className={classnames(
            'btn',
            `btn-${size}`,
            `btn-${style}`,
            'tribe-join',
            {
              'btn-active': isMember,
              'btn-disabled': isUpdating,
            },
          )}
          disabled={isUpdating}
          aria-label={
            isMember
              ? t('Leave circle')
              : t('Join ({{label}})', { label: tribe.label })
          }
          onClick={handleToggleMembership}
          {...rest}
        >
          {icon && <i className={isMember ? 'icon-ok' : 'icon-plus'} />}
          {isMember ? t('Joined') : t('Join')}
        </button>
      </Tooltip>
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
