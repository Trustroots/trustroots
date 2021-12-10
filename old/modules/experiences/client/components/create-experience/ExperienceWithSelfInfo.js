import '@/config/client/i18n';
import { useTranslation } from 'react-i18next';
import React from 'react';

/**
 * Error message when trying to share and experience with oneself.
 */
export default function ExperienceWithSelfInfo() {
  const { t } = useTranslation('experiences');

  return (
    <div role="alert" className="alert alert-warning">
      {t("Sorry, you can't share experience only with yourself.")}
    </div>
  );
}
