import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';

import '@/config/client/i18n';
import Icon from '@/modules/core/client/components/Icon';

/**
 * A button to report a member to Trustroots support
 * @param {string} className - CSS classname for the link
 * @param {string} username - the username of the user to report
 */
export default function ReportMember({ className, username }) {
  const { t } = useTranslation('support');

  if (!username) {
    return null;
  }

  return (
    <a
      href={`/support?report=${username}`}
      className={className}
      aria-label={t('Report member {{username}} to support', { username })}
    >
      <Icon icon="flag" />
      {t('Report member to support')}
    </a>
  );
}

ReportMember.propTypes = {
  className: PropTypes.string,
  username: PropTypes.string.isRequired,
};
