// External dependencies
import { useTranslation } from 'react-i18next';
import React from 'react';

// Internal dependencies
import NoContent from '@/modules/core/client/components/NoContent';

export default function SearchMapNoContent() {
  const { t } = useTranslation('search');
  return (
    <NoContent
      className="tw:mx-auto tw:flex tw:h-screen tw:flex-col tw:justify-center tw:bg-white/50 tw:text-[#333] tw:[&.content-empty_i]:text-[#333]"
      icon="users"
      message={String(t('Zoom closer to find members.'))}
    />
  );
}
