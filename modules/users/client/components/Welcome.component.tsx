import React from 'react';
import { Button } from '@trustroots/ui/Button';
import { useTranslation } from 'react-i18next';

export default function Welcome() {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  return (
    <section className="tw:page-container container-spacer">
      <div className="tw:grid-row">
        <div className="tw:grid-offset-2 tw:grid-col-8 tw:md:grid-offset-3 tw:md:grid-col-6 text-center">
          <img
            className="tw:max-sm:hidden"
            src="/img/tree-color.svg"
            alt="Trustroots"
            width="120"
            height="120"
            aria-hidden="true"
          />
          <img
            className="tw:inline-block tw:sm:hidden"
            src="/img/tree-color.svg"
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
            <Button
              intent="primary"
              size="lg"
              render={<a href="/profile/edit" />}
            >
              {t('Fill your profile')}
            </Button>
          </p>
        </div>
      </div>
    </section>
  );
}
