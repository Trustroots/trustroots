import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';
import { Button, type ButtonStyleProps } from '@trustroots/ui/Button';
import LeaveTribeModal from './LeaveTribeModal';
import Tooltip from '@/modules/core/client/components/Tooltip';

import * as api from '../api/tribes.api';
import type { MembershipUpdate, TribeSummary } from '../api/tribes.api';
import type { UserProfile } from '@/modules/users/client/types';

interface PresentationalProps {
  /** Hook class added while the user is a member. */
  activeClassName?: string;
  /** Button look while the user is a member; falls back to `look`. */
  activeLook?: ButtonStyleProps;
  className?: string;
  /** Button look; defaults to a small default button. */
  look?: ButtonStyleProps;
  icon?: boolean;
  isMember: boolean;
  isLoading?: boolean;
  memberLabel?: string;
  tribe: TribeSummary;
  isLoggedIn: boolean;
  onToggle?: () => void;
}

interface JoinButtonProps extends Omit<
  PresentationalProps,
  'isMember' | 'isLoggedIn' | 'isLoading' | 'onToggle'
> {
  tribe: TribeSummary;
  user?: UserProfile;
  onUpdated?: (data: MembershipUpdate) => void;
}

const TooltipWithContent = Tooltip as unknown as React.ComponentType<{
  tooltip: React.ReactNode;
  placement: 'bottom';
  hidden?: boolean;
  id?: string;
  children: React.ReactNode;
}>;

function JoinButtonPresentational({
  className,
  activeClassName,
  look = { size: 'sm' },
  activeLook,
  icon = true,
  isMember,
  isLoading,
  memberLabel,
  tribe,
  isLoggedIn,
  onToggle,
}: PresentationalProps) {
  const { t } = useTranslation('circles') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  const ariaLabel = isMember
    ? (t('Leave circle') as string)
    : (t('Join ({{label}})', { label: tribe.label }) as string);
  const buttonLabel = isMember
    ? memberLabel || (t('Joined') as string)
    : (t('Join') as string);
  const currentLook = isMember && activeLook ? activeLook : look;

  // a button to be shown when user is signed out
  if (!isLoggedIn) {
    return (
      <Button
        {...look}
        render={<a href={`/signup?tribe=${tribe.slug}`} />}
        className={classnames(className, 'tribe-join')}
      >
        {icon && (
          <>
            <i className="icon-plus" />{' '}
          </>
        )}
        {buttonLabel}
      </Button>
    );
  }

  return (
    <TooltipWithContent
      tooltip={t('Leave circle') as string}
      placement="bottom"
      hidden={!isMember}
      id={`tribe-${tribe._id}`}
    >
      <Button
        {...currentLook}
        type="button"
        className={classnames(
          isMember && 'tribe-join-active',
          isMember && activeClassName,
          className,
          'tribe-join',
        )}
        disabled={isLoading}
        aria-label={ariaLabel}
        onClick={onToggle}
      >
        {icon && (
          <>
            <i className={isMember ? 'icon-ok' : 'icon-plus'} />{' '}
          </>
        )}
        {buttonLabel}
      </Button>
    </TooltipWithContent>
  );
}

// @TODO this can (and should) be replaced by other container, when we finish the migration; when we start using redux etc.
export default function JoinButton({
  tribe,
  user,
  onUpdated,
  ...rest
}: JoinButtonProps) {
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
      onUpdated?.(data);
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
    onUpdated?.(data);
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
        {...rest}
        onToggle={handleToggleMembership}
      />
    </>
  );
}
