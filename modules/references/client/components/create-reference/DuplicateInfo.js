import '@/config/client/i18n';
import { useTranslation, Trans } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';
import UserLink from '@/modules/users/client/components/UserLink';

/**
 * Error message when reference was already given
 * @param {User} userTo
 */
export default function DuplicateInfo({ userTo }) {
  const { t } = useTranslation('references');
  return (
    <div role="alert" className="alert alert-warning">
      {/* @TODO remove ns (issue #1368) */}
      <Trans t={t} ns="references">
        You&apos;ve already given a reference to <UserLink user={userTo} />.
      </Trans>
    </div>
  );
}

DuplicateInfo.propTypes = {
  userTo: PropTypes.object.isRequired,
};
