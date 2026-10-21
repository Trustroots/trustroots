// External dependencies
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';
import React from 'react';
import { Button } from '@trustroots/ui';

// Internal dependencies
import Tooltip from '@/modules/core/client/components/Tooltip.js';

interface OfferStatusButtonProps {
  isOwnOffer: boolean;
  username?: string;
  status?: 'yes' | 'no' | 'maybe';
}

interface TooltipProps {
  children: React.ReactNode;
  id: string;
  placement: string;
  tooltip: string;
}

const AccessibleTooltip =
  Tooltip as unknown as React.ComponentType<TooltipProps>;

export default function OfferStatusButton({
  isOwnOffer,
  username,
  status,
}: OfferStatusButtonProps) {
  const { t } = useTranslation('offers');

  return (
    <AccessibleTooltip
      id="tooltip-change-host-offer"
      placement="left"
      tooltip={isOwnOffer ? t('Change') : t('Send a message')}
    >
      <Button
        as="a"
        size="sm"
        className={classnames('pull-right btn-offer-hosting', {
          'btn-offer-hosting-no': !status || status === 'no',
          'btn-offer-hosting-yes': status === 'yes',
          'btn-offer-hosting-maybe': status === 'maybe',
        })}
        href={isOwnOffer ? '/offer/host' : `/messages/${username}`}
      >
        {(!status || status === 'no') && String(t('Cannot host currently'))}
        {status === 'yes' && String(t('Can host'))}
        {status === 'maybe' && String(t('Might be able to host'))}
      </Button>
    </AccessibleTooltip>
  );
}
