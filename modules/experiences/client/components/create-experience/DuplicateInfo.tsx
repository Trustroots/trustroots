// External dependencies
import { useTranslation } from 'react-i18next';
import { Button } from '@trustroots/ui/Button';
import React from 'react';

// Internal dependencies
import '@/config/client/i18n';
import SuccessMessage from '@/modules/core/client/components/SuccessMessage';

/**
 * Error message when experience was already shared
 */
export default function DuplicateInfo({ username }: { username: string }) {
  const { t } = useTranslation('experiences') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  return (
    <SuccessMessage
      title={t('You already shared your experience with them') as string}
      cta={
        <Button
          colour="primary"
          render={<a href={`/profile/${username}/experiences`} />}
        >
          {t('See their experiences') as string}
        </Button>
      }
    ></SuccessMessage>
  );
}
