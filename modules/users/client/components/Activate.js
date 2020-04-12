import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import '@/config/client/i18n';

export default function Activate() {
  const { t } = useTranslation('users');

  return (
    <div
      className="row"
      role="alertdialog"
      aria-labelledby="activate-profile-message"
    >
      <div className="col-xs-12 text-center" role="document" tabIndex="0">
        <h2>{t("Don't panic!")}</h2>
        <p className="lead" id="activate-profile-message">
          <em>
            {t(
              'Sorry, you need to first activate your profile by confirming your email.',
            )}
          </em>
        </p>
        <p>
          {/* @TODO remove ns (issue #1368) */}
          <Trans t={t} ns="users">
            If you didn&apos;t receive the message, check your spam folder or
            resend it via
            <a href="/profile/edit/account">email settings</a>.
          </Trans>
        </p>
        <p>
          <br />
          <small>
            <a
              className="btn btn-xs btn-link text-muted"
              href="/support"
              aria-label={t('Support')}
            >
              {t('Help!')}
            </a>
          </small>
        </p>
      </div>
    </div>
  );
}
