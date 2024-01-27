import React from 'react';
import Faq from '@/modules/pages/client/components/Faq.component.js';
import { Trans, useTranslation } from 'react-i18next';

export default function FaqTechnology() {
  const { t } = useTranslation('pages');

  return (
    <Faq category="technology">
      <div className="faq-question" id="opensource">
        <h3>{t('Is Trustroots open source?')}</h3>
        <Trans t={t} ns="pages">
          Yes! Our code is available on{' '}
          <a href="https://github.com/Trustroots/trustroots/">GitHub</a> and
          licensed under the{' '}
          <a href="https://github.com/Trustroots/trustroots/blob/master/LICENSE.md">
            AGPL License
          </a>
          .
        </Trans>
      </div>

      <div className="faq-question" id="im-a-developer">
        <h3>{t("I'm a developer and I want to help!")}</h3>
        <Trans t={t} ns="pages">
          Great! We&apsos;re only actively working on moving trustroots to
          nostr. If that&apsos;s something you want to help with, check the{' '}
          <a href="https://github.com/Trustroots/nostroots">nostroots</a> repo
          to get involved.
        </Trans>
      </div>

      <div className="faq-question" id="are-you-planning-to-do-x-feature">
        <h3>{t('Are you planning to do X feature?')}</h3>
        <Trans t={t} ns="pages">
          The main trustroots site is in maintenance mode since late 2022.
          We&apos;re not adding new features. But we are working on moving the
          whole platform over to nostr so that anyone can develop new features.
        </Trans>
      </div>

      <div className="faq-question" id="statistics">
        <h3>{t('Do you have public statistics?')}</h3>
        <Trans t={t} ns="pages">
          Yep, see <a href="/statistics">statistics</a> page for some basic
          statistics. We are planning to publish more thorough statistics
          eventually. If you are interested in analysing our data deeper, please{' '}
          <a href="/contact">write to us</a>.
        </Trans>
      </div>
    </Faq>
  );
}

FaqTechnology.propTypes = {};
