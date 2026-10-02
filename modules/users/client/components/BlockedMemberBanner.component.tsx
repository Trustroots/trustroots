/**
 * Banner that describes that user is blocked
 */

import '@/config/client/i18n';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';

import BlockMember from './BlockMember.component';
import ReportMemberImplementation from '@/modules/support/client/components/ReportMember.component.js';

const ReportMember =
  ReportMemberImplementation as unknown as React.ComponentType<{
    username: string;
    className?: string;
  }>;

export default function BlockedMemberBanner({
  username,
}: {
  username: string;
}) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  return (
    <div className="alert alert-warning" role="alert">
      <p>
        {t('You have blocked this member.')}{' '}
        {t('They cannot see or message you.')}
        <ReportMember username={username} className="btn btn-link" />
        <BlockMember isBlocked username={username} className="btn btn-link" />
      </p>
    </div>
  );
}

BlockedMemberBanner.propTypes = {
  username: PropTypes.string.isRequired,
};
