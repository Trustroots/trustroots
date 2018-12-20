import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * I'm just a little loading info.
 */
export default function Loading() {
  const { t } = useTranslation('core');
  return (<div>{t('Wait a moment...')}</div>);
}
