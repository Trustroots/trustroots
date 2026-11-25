import React, { useEffect, useState } from 'react';
import { Alert } from '@trustroots/ui/Alert';
import { Button } from '@trustroots/ui/Button';
import { useTranslation } from 'react-i18next';

declare global {
  interface Window {
    trMobileApp?: { os?: string };
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}

const downloadUrl = 'https://team.trustroots.org/apps/latest-apk/';
const dismissalKey = 'trustroots:legacy-android-upgrade-dismissed';

export default function LegacyAndroidUpgradeNotice() {
  const { t } = useTranslation('core');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function detectLegacyAndroidApp() {
      if (
        window.trMobileApp?.os !== 'android' ||
        typeof window.ReactNativeWebView?.postMessage !== 'function'
      ) {
        return;
      }

      document.removeEventListener('message', onAppMessage);
      try {
        if (window.localStorage.getItem(dismissalKey) === 'true') {
          return;
        }
      } catch {
        // The notice can still be shown when storage is unavailable.
      }
      setVisible(true);
    }

    function onAppMessage(event: Event) {
      if ('data' in event && event.data === 'trMobileAppInit') {
        detectLegacyAndroidApp();
      }
    }

    // The Expo Android WebView injects its metadata when the page loads and
    // repeats this message on the document, including when injection is late.
    document.addEventListener('message', onAppMessage);
    detectLegacyAndroidApp();
    return () => document.removeEventListener('message', onAppMessage);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <Alert intent="info" role="note">
      <p>
        <strong>{t('Switch to the new Trustroots app for Android')}</strong>
      </p>
      <p>
        {t(
          'This app is no longer supported. Download the Android preview, sign in with your existing Trustroots account, then remove the old app.',
        )}
      </p>
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <Button
          intent="primary"
          render={<a href={downloadUrl} />}
          onClick={event => {
            const bridge = window.ReactNativeWebView;
            if (typeof bridge?.postMessage === 'function') {
              bridge.postMessage(
                JSON.stringify({ action: 'openUrl', url: downloadUrl }),
              );
              event.preventDefault();
            }
          }}
        >
          {t('Download for Android')}
        </Button>
        <Button
          intent="neutral"
          variant="outline"
          onClick={() => {
            setVisible(false);
            try {
              window.localStorage.setItem(dismissalKey, 'true');
            } catch {
              // The notice stays dismissed for this page without storage.
            }
          }}
        >
          {t('Dismiss')}
        </Button>
      </div>
    </Alert>
  );
}
