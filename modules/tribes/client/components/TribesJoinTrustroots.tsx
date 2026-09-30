import React from 'react';
import { useTranslation } from 'react-i18next';

export default function TribesJoinTrustroots() {
  const { t } = useTranslation('circles') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  return (
    <div className="row">
      <div className="col-xs-12 text-center">
        <hr />
        <p className="lead">
          {t('Join Trustroots to find members behind circles.') as string}
        </p>
        <br />
        <br />
        <a href="/signup" className="btn btn-action btn-primary">
          {t('Sign up with Trustroots') as string}
        </a>
        <br />
        <br />
      </div>
    </div>
  );
}

TribesJoinTrustroots.propTypes = {};
