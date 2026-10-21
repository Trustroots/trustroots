import { useTranslation } from 'react-i18next';
import React from 'react';
import { Button } from '@trustroots/ui';

export default function NotFoundPage() {
  const { t } = useTranslation('core');

  return (
    <section className="container container-fullscreen container-error board board-error">
      <div className="middle-wrapper middle-wrapper-horizontal">
        <div className="middle-content">
          <div className="row">
            <div className="col-md-6 col-md-offset-3 text-center">
              <h1>{t<string>('This page cannot be found.')}</h1>
              <br />
              <br />
              <Button as="a" href="/" variant="default" size="md">
                {t<string>('Continue…')}
              </Button>{' '}
              <Button as="a" href="/support" variant="default" size="md">
                {t<string>('Contact us')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
