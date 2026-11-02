/**
 * Banner that describes that user is blocked
 */

import '@/config/client/i18n';
import { useTranslation } from 'react-i18next';
import React from 'react';

import type { ButtonStyleProps } from '@trustroots/ui/Button';
import BlockMember from './BlockMember.component';
import ReportMemberImplementation from '@/modules/support/client/components/ReportMember.component.js';

const ReportMember =
  ReportMemberImplementation as unknown as React.ComponentType<{
    username: string;
    look?: ButtonStyleProps;
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
        <ReportMember username={username} look={{ variant: 'link' }} />
        <BlockMember isBlocked username={username} look={{ variant: 'link' }} />
      </p>
    </div>
  );
}
