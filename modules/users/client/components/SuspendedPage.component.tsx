import { useTranslation } from 'react-i18next';
import { Button } from '@trustroots/ui/Button';
import React from 'react';

export default function SuspendedPage() {
  const { t } = useTranslation('users');

  return (
    <section className="tw:page-container container-fullscreen container-error board board-error">
      <div className="middle-wrapper middle-wrapper-horizontal">
        <div className="middle-content">
          <div className="tw:grid-row">
            <div
              className="tw:md:grid-col-6 tw:md:grid-offset-3 text-center"
              role="alert"
            >
              <h1>{t('Your account has been suspended.')}</h1>
              <br />
              <br />
              <Button render={<a href="/rules" />}>
                {t('Rules Of Trustroots')}
              </Button>{' '}
              <Button render={<a href="/contact" />}>
                {t('Contact us', { ns: 'core' })}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
