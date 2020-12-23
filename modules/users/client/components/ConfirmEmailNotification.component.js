import { Trans, useTranslation } from 'react-i18next';
import React from 'react';

export default function ConfirmEmailNotification() {
  const { t } = useTranslation('users');

  return (
    <div className="row text-center">
      <em className="lead">
        {t(
          'Note that your profile will not be visible to others until you confirm your email.',
        )}
      </em>
      <p>
        <Trans t={t} ns="users">
          If you didn&rsquo;t receive the message, check your spam folder or
          resend it via <a href="/profile/edit/account">email settings</a>.
        </Trans>
      </p>
      <hr />
    </div>
  );
}

ConfirmEmailNotification.propTypes = {};
