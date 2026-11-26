import { Input } from '@trustroots/ui/Input';
import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@trustroots/ui/cn';
import { Button, type ButtonStyleProps } from '@trustroots/ui/Button';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@trustroots/ui/Modal';
import { useAnalytics, type CircleSource } from '@trustroots/analytics/client';
import LeaveTribeModal from './LeaveTribeModal';
import { Tooltip } from '@trustroots/ui/Tooltip';

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
  tribe: Pick<TribeSummary, '_id' | 'label' | 'slug'>;
  isLoggedIn: boolean;
  onToggle?: () => void;
}

interface JoinButtonProps extends Omit<
  PresentationalProps,
  'isMember' | 'isLoggedIn' | 'isLoading' | 'onToggle'
> {
  tribe: Pick<TribeSummary, '_id' | 'label' | 'slug'>;
  user?: UserProfile;
  onUpdated?: (data: MembershipUpdate) => void;
  /** Where the button is shown, for analytics; defaults to 'other'. */
  source?: CircleSource;
}

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
        className={cn(className, 'tribe-join')}
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
    <Tooltip
      tooltip={t('Leave circle') as string}
      placement="bottom"
      hidden={!isMember}
    >
      <Button
        {...currentLook}
        type="button"
        className={cn(
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
    </Tooltip>
  );
}

// @TODO this can (and should) be replaced by other container, when we finish the migration; when we start using redux etc.
export default function JoinButton({
  tribe,
  user,
  onUpdated,
  source = 'other',
  ...rest
}: JoinButtonProps) {
  const { track } = useAnalytics();
  const { t } = useTranslation('circles') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  // isLeaving controls whether the modal for leaving a tribe is shown
  const [isLeaving, setIsLeaving] = useState(false);

  const [isUpdating, setIsUpdating] = useState(false);
  const [isWritingReason, setIsWritingReason] = useState(false);
  const [joinReason, setJoinReason] = useState('');
  const [joinFailed, setJoinFailed] = useState(false);
  const reasonId = useId();

  const isMemberInitial = (user?.memberIds || []).includes(tribe._id);
  const [isMember, setIsMember] = useState(isMemberInitial);

  /**
   * Handle joining or leaving of a tribe
   * - Join: offer a reason on the circle page
   * - Leave: show confirmation modal
   */
  async function handleToggleMembership() {
    if (isMember) {
      setIsLeaving(true);
    } else if (user && source === 'circle_page') {
      setJoinReason('');
      setJoinFailed(false);
      setIsWritingReason(true);
    } else {
      await joinWithReason('');
    }
  }

  async function joinWithReason(reason = joinReason) {
    setJoinFailed(false);
    const trimmedReason = reason.trim();
    // updating starts
    setIsUpdating(true);

    // join
    let data: MembershipUpdate;
    try {
      data = trimmedReason
        ? await api.join(tribe._id, { joinReason: trimmedReason })
        : await api.join(tribe._id);
    } catch {
      setJoinFailed(true);
      setIsUpdating(false);
      return;
    }
    setIsWritingReason(false);
    track('circle_joined', { source });
    // update the membership locally
    setIsMember(true);

    // updating finished
    setIsUpdating(false);
    // tell the ancestor components that the membership was updated
    onUpdated?.(data);
  }

  function handleCancelJoin() {
    setIsWritingReason(false);
  }

  /**
   * Leave a tribe (api call)
   */
  async function handleLeave() {
    setIsUpdating(true);
    let data: MembershipUpdate;
    try {
      data = await api.leave(tribe._id);
    } catch {
      // Close the dialog and keep the membership so the member can retry.
      setIsUpdating(false);
      setIsLeaving(false);
      return;
    }
    setIsUpdating(false);
    setIsLeaving(false);
    setIsMember(false);
    track('circle_left', { source });
    // tell the ancestor components that the membership was updated
    onUpdated?.(data);
  }

  function handleCancelLeave() {
    setIsLeaving(false);
  }

  return (
    <>
      {isWritingReason && (
        <Modal open onClose={handleCancelJoin}>
          <form
            onSubmit={event => {
              event.preventDefault();
              void joinWithReason();
            }}
          >
            <ModalHeader>
              <ModalTitle>
                {t('Join {{label}}', { label: tribe.label })}
              </ModalTitle>
            </ModalHeader>
            <ModalBody>
              <label htmlFor={reasonId}>
                {t('Why would you like to join? (optional)')}
              </label>
              <Input
                id={reasonId}
                aria-describedby={`${reasonId}-help`}
                type="text"
                maxLength={160}
                disabled={isUpdating}
                value={joinReason}
                onChange={event => setJoinReason(event.target.value)}
              />
              <p className="help-block" id={`${reasonId}-help`}>
                {t(
                  'Signed-in members who can view your profile can read this.',
                )}
              </p>
              {joinFailed && (
                <p role="alert">
                  {t('Could not join the circle. Please try again.')}
                </p>
              )}
            </ModalBody>
            <ModalFooter>
              <Button type="button" onClick={handleCancelJoin}>
                {t('Cancel')}
              </Button>
              <Button type="submit" intent="primary" disabled={isUpdating}>
                {t('Join circle')}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}
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
