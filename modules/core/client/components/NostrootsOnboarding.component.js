import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import qrcode from 'qrcode-generator';
import { getNostrootsOnboardingUrl } from '../utils/nostroots-onboarding';

export default function NostrootsOnboarding({ username, source, linkRef }) {
  const { t } = useTranslation('core');
  const url = getNostrootsOnboardingUrl(username);
  const qrImage = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    return qr.createDataURL(4);
  }, [url]);

  return (
    <div className="nostroots-onboarding">
      <p>
        {t('Post map notes, share travel tips and connect with travellers.')}
      </p>
      <p>
        {t(
          'This opens account setup in Nostroots. It does not sign you in automatically.',
        )}
      </p>
      {username && (
        <p>
          {t('Your username will be filled in: {{username}}.', { username })}
        </p>
      )}
      <a
        ref={linkRef}
        href={url}
        rel="noreferrer"
        className="btn btn-primary btn-block nostroots-modal-btn"
        data-umami-event="nostroots-onboarding"
        data-umami-event-source={source}
      >
        {t('Continue in Nostroots')}
      </a>
      <div className="nostroots-onboarding-qr hidden-xs">
        <img
          src={qrImage}
          alt={t('Scan to continue in Nostroots on your phone')}
          width="180"
          height="180"
        />
        <p>{t('Scan with your phone to open the same onboarding link.')}</p>
      </div>
      <p className="help-block nostroots-onboarding-help">
        {t(
          'If you need to install the app, return to this page and open the link again afterwards.',
        )}
      </p>
    </div>
  );
}

NostrootsOnboarding.propTypes = {
  username: PropTypes.string,
  source: PropTypes.oneOf([
    'community-notes',
    'profile-notes',
    'network-settings',
  ]).isRequired,
  linkRef: PropTypes.shape({ current: PropTypes.any }),
};
