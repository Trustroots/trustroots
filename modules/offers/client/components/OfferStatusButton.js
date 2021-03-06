// External dependencies
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import Tooltip from '@/modules/core/client/components/Tooltip.js';

export default function OfferStatusButton({ isOwnOffer, username, status }) {
  const { t } = useTranslation('offers');

  return (
    <Tooltip
      id="tooltip-change-host-offer"
      placement="left"
      tooltip={isOwnOffer ? t('Change') : t('Send a message')}
    >
      <a
        className={classnames('btn btn-sm pull-right btn-offer-hosting', {
          'btn-offer-hosting-no': !status || status === 'no',
          'btn-offer-hosting-yes': status === 'yes',
          'btn-offer-hosting-maybe': status === 'maybe',
        })}
        href={isOwnOffer ? '/offer/host' : `/messages/${username}`}
      >
        {(!status || status === 'no') && t('Cannot host currently')}
        {status === 'yes' && t('Can host')}
        {status === 'maybe' && t('Might be able to host')}
      </a>
    </Tooltip>
  );
}

OfferStatusButton.propTypes = {
  isOwnOffer: PropTypes.bool.isRequired,
  status: PropTypes.string,
  username: PropTypes.string,
};
