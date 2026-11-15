// External dependencies
import { useTranslation } from 'react-i18next';
import React from 'react';
import './search-map-no-content.css';

// Internal dependencies
import NoContent from '@/modules/core/client/components/NoContent';

export default function SearchMapNoContent() {
  const { t } = useTranslation('search');
  return (
    <NoContent
      className="search-map-no-content"
      icon="users"
      message={String(t('Zoom closer to find members.'))}
    />
  );
}
