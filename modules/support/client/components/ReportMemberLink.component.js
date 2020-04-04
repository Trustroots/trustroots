/**
 * A link to report member
 * @param {string} username - the username of the user to report
 */

import React from 'react';
import PropTypes from 'prop-types';
import '@/config/client/i18n';
import { useTranslation } from 'react-i18next';

export default function ReportMemberLink({ username }) {
  const { t } = useTranslation('support');

  return (
    <a
      href={`/support?report=${username}`}
      className="small text-muted"
      aria-label={t('Report member {{username}} to support', { username })}
    >
      {t('Report member')}
    </a>
  );
}

ReportMemberLink.propTypes = {
  username: PropTypes.string.isRequired,
};
