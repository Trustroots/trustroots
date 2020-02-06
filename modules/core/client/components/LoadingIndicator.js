// External dependencies
import { useTranslation } from 'react-i18next';
import React from 'react';

export default function LoadingIndicator() {
  const { t } = useTranslation('core');
  return (
    <div
      aria-busy="true"
      aria-live="assertive"
      className="content-wait"
      role="alertdialog"
    >
      <small>{t('Wait a moment…')}</small>
    </div>
  );
}
