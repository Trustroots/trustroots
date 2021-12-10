import { useTranslation } from 'react-i18next';
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
              <a href="/" className="btn btn-default btn-md">
                {t('Continue…')}
              </a>{' '}
              <a href="/support" className="btn btn-default btn-md">
                {t('Contact us')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

NotFoundPage.propTypes = {};
