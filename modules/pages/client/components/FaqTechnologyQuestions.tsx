import type { PageTranslator } from '../types';
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

export default function FaqTechnologyQuestions() {
  const { t: rawT } = useTranslation('pages');
  const t = rawT as unknown as PageTranslator;

  return (
    <>
      <div className="faq-question" id="opensource">
        <h3>{t('Is Trustroots open source?')}</h3>
        <Trans t={rawT} ns="pages">
          Yes! Our code is available on{' '}
          <a href="https://github.com/Trustroots/trustroots/">GitHub</a> and
          licensed under the{' '}
          <a href="https://github.com/Trustroots/trustroots/blob/main/LICENSE.md">
            AGPL License
          </a>
          .
        </Trans>
      </div>

      <div className="faq-question" id="im-a-developer">
        <h3>{t("I'm a developer and I want to help!")}</h3>
        <Trans t={rawT} ns="pages">
          Great! We&apos;re actively developing Trustroots again. For larger
          product changes, we&apos;re focusing on Nostroots, our Nostr-based
          project. Check the{' '}
          <a href="https://github.com/Trustroots/nostroots">
            Nostroots repository
          </a>{' '}
          to get involved.
        </Trans>
      </div>

      <div className="faq-question" id="are-you-planning-to-do-x-feature">
        <h3>{t('Are you planning to do X feature?')}</h3>
        <Trans t={rawT} ns="pages">
          Trustroots is under active development again, and smaller improvements
          and fixes are welcome here. Larger product changes are focused on{' '}
          <a href="https://nos.trustroots.org/">Nostroots</a>, our Nostr-based
          project.
        </Trans>
      </div>

      <div className="faq-question" id="statistics">
        <h3>{t('Do you have public statistics?')}</h3>
        <Trans t={rawT} ns="pages">
          Yep, see <a href="/statistics">statistics</a> page for some basic
          statistics. We are planning to publish more thorough statistics
          eventually. If you are interested in analysing our data deeper, please{' '}
          <a href="/contact">write to us</a>.
        </Trans>
      </div>
      <div className="faq-question" id="f-droid">
        <h3>{t('Could you offer mobile app at F-Droid store?')}</h3>
        <Trans t={rawT} ns="pages">
          You can follow F-Droid availability in the open{' '}
          <a href="https://github.com/Trustroots/Trustroots-React-Native/issues/17">
            React Native app issue
          </a>{' '}
          and{' '}
          <a href="https://github.com/Trustroots/trustroots-expo-mobile/issues/3">
            Expo app issue
          </a>
          . See also the{' '}
          <a href="https://github.com/search?q=org%3ATrustroots+F-Droid+in%3Atitle+is%3Apr+is%3Aopen&type=pullrequests">
            related open pull requests
          </a>
          .
        </Trans>
      </div>
    </>
  );
}
