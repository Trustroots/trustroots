import React from 'react';
import { useTranslation } from 'react-i18next';

export default function SuggestTribe() {
  const { t } = useTranslation('tribes');

  return <div className="panel tribe text-center flex-centered">
    <p className="lead">
      <span className="icon-tribes icon-lg"></span>
      <br />
      {t('Missing your Tribe?')}
      <br />
      <br />
      <a href="https://goo.gl/forms/B9EPVfBvMRuRivcH3"
        target="_blank"
        rel="noreferrer noopener"
        className="btn btn-md btn-default"
      >
        {t('Send us suggestions!')} <i className="icon-link-ext"></i>
      </a>
    </p>
  </div>;
}

SuggestTribe.propTypes = {};
