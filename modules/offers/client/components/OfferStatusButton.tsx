// External dependencies
import { useTranslation } from 'react-i18next';
import React from 'react';
import { Button } from '@trustroots/ui/Button';

// Internal dependencies
import { rememberOutreachSource } from '@trustroots/analytics/client';
import { Tooltip } from '@trustroots/ui/Tooltip';
import { hostStatusIntent } from './hostStatusIntent';
import { hostStatusLabel } from './hostStatusLabel';

interface OfferStatusButtonProps {
  isOwnOffer: boolean;
  username?: string;
  status?: 'yes' | 'no' | 'maybe';
}

export default function OfferStatusButton({
  isOwnOffer,
  username,
  status,
}: OfferStatusButtonProps) {
  const { t } = useTranslation('offers');

  return (
    <Tooltip
      placement="left"
      tooltip={isOwnOffer ? t('Change') : t('Send a message')}
    >
      <Button
        intent={hostStatusIntent[status ?? 'no']}
        size="sm"
        className="offer-hosting-button pull-right"
        render={
          // oxlint-disable-next-line jsx-a11y/anchor-has-content -- Button renders the label inside it.
          <a
            href={isOwnOffer ? '/offer/host' : `/messages/${username}`}
            onClick={
              isOwnOffer
                ? undefined
                : () => rememberOutreachSource(username, 'offer')
            }
          />
        }
      >
        {hostStatusLabel(status ?? 'no', key => String(t(key)))}
      </Button>
    </Tooltip>
  );
}
