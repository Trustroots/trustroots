import React from 'react';
import { useTranslation } from 'react-i18next';
import '@/config/client/i18n';

export default function ManifestoText() {
  const { t } = useTranslation('pages');

  return (
    <>
      <h2 className="font-brand-semibold">{t('Manifesto')}</h2>
      <br />
      {t(`We want a world that encourages trust, adventure and intercultural
      connections.`)}
      <br />
      <br />
      {t(`Our willingness to help each other is universal. Trustroots is completely free
      to use and will remain so forever.`)}
      <br />
      <br />
      {t('We believe in beauty, simplicity and transparency.')}
      <br />
      <br />
      {t('We emphasize community.')}
    </>
  );
}

ManifestoText.propTypes = {};
