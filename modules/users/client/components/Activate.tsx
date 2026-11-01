import React from 'react';
import { Button } from '@trustroots/ui/Button';
import { Trans, useTranslation } from 'react-i18next';
import '@/config/client/i18n';

export default function Activate() {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  return (
    <div
      className="row"
      role="alertdialog"
      aria-labelledby="activate-profile-message"
    >
      <div className="col-xs-12 text-center" role="document">
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
          <Trans ns="users">
            If you didn&apos;t receive the message, check your spam folder or
            resend it via
            <a href="/profile/edit/account">email settings</a>.
          </Trans>
        </p>
        <p>
          <br />
          <small>
            <Button
              variant="link"
              colour="muted"
              size="xs"
              render={<a href="/support" />}
              aria-label={t('Support')}
            >
              {t('Help!')}
            </Button>
          </small>
        </p>
      </div>
    </div>
  );
}
