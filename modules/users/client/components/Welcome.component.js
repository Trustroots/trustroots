import React from 'react';
import { useTranslation } from 'react-i18next';

export default function Welcome() {
  const { t } = useTranslation('users');

  return (
    <section className="container container-spacer">
      <div className="row">
        <div className="col-xs-offset-2 col-xs-8 col-md-offset-3 col-md-6 text-center">
          <img
            className="hidden-xs"
            src="/placeholder.png"
            alt="Trustroots"
            width="120"
            height="120"
            aria-hidden="true"
          />
          <img
            className="visible-xs-inline-block"
            src="/placeholder.png"
            alt="Trustroots"
            width="80"
            height="80"
            aria-hidden="true"
          />
          <h2>{t('Hey, welcome!')}</h2>
          <p className="lead">
            {t(
              'Being able to rely on strangers, on communities, on trust, are values that are worth preserving.',
            )}{' '}
            {t('Go travel & spread the word!')}
            <br />
            <br />
            <a href="/profile/edit" className="btn btn-lg btn-primary">
              {t('Fill your profile')}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

Welcome.propTypes = {};
