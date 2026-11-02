import { useTranslation } from 'react-i18next';
import { Button } from '@trustroots/ui/Button';
import React from 'react';

export default function NotFoundPage() {
  const { t } = useTranslation('core');

  return (
    <section className="container container-fullscreen container-error board board-error">
      <div className="middle-wrapper middle-wrapper-horizontal">
        <div className="middle-content">
          <div className="row">
            <div className="col-md-6 col-md-offset-3 text-center">
              <h1>{t('This page cannot be found.')}</h1>
              <br />
              <br />
              <Button render={<a href="/" />}>{t('Continue…')}</Button>{' '}
              <Button render={<a href="/support" />}>{t('Contact us')}</Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
