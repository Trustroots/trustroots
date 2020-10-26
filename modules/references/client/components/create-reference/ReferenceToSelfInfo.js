import '@/config/client/i18n';
import { useTranslation } from 'react-i18next';
import React from 'react';

/**
 * Error message when trying to give a reference to oneself.
 */
export default function ReferenceToSelfInfo() {
  const { t } = useTranslation('references');

  return (
    <div role="alert" className="alert alert-warning">
      {t("Sorry, you can't give a reference to yourself.")}
    </div>
  );
}
