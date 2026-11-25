/**
 * Banner that describes that user is blocked
 */

import '@/config/client/i18n';
import { useTranslation } from 'react-i18next';
import React from 'react';

import BlockMember from './BlockMember.component';
import ReportMember from '@/modules/core/client/components/ReportMember.component';
import { Alert } from '@trustroots/ui/Alert';

export default function BlockedMemberBanner({
  username,
}: {
  username: string;
}) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  return (
    <Alert intent="warning" role="alert">
      <p>
        {t('You have blocked this member.')}{' '}
        {t('They cannot see or message you.')}
        <ReportMember username={username} look={{ variant: 'link' }} />
        <BlockMember isBlocked username={username} look={{ variant: 'link' }} />
      </p>
    </Alert>
  );
}
