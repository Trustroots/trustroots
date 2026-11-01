/**
 * Banner that describes that user is blocked
 */

import '@/config/client/i18n';
import { useTranslation } from 'react-i18next';
import React from 'react';

import BlockMember from './BlockMember.component';
import ReportMemberImplementation from '@/modules/support/client/components/ReportMember.component.js';
import { Alert } from '@trustroots/ui/Alert';

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
    <Alert tone="warning" role="alert">
      <p>
        {t('You have blocked this member.')}{' '}
        {t('They cannot see or message you.')}
        <ReportMember username={username} className="btn btn-link" />
        <BlockMember isBlocked username={username} className="btn btn-link" />
      </p>
    </Alert>
  );
}
