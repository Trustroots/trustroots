import type { PageTranslator } from '../types';
import React from 'react';
import Faq from '@/modules/pages/client/components/Faq.component.js';
import { Trans, useTranslation } from 'react-i18next';

export default function FaqBugsAndFeatures() {
  const { t: rawT } = useTranslation('pages');
  const t = rawT as unknown as PageTranslator;

  return (
    <Faq category="bugs-and-features">
      <div className="faq-question" id="how-do-i-report-a-bug">
        <h3>{t('How do I report a bug?')}</h3>
        <Trans t={rawT} ns="pages">
          Thank you for helping us improve Trustroots. To report a bug,{' '}
          <a href="/support?category=reportBug">contact us</a> and choose
          &ldquo;Report a bug&rdquo;. Tell us what happened, what you expected,
          and how we can reproduce the problem.
        </Trans>
        <br />
        <br />
        <Trans t={rawT} ns="pages">
          If you prefer, you can also report bugs or follow their progress on{' '}
          <a href="https://github.com/Trustroots/trustroots/issues">GitHub</a>.
          Using GitHub is optional.
        </Trans>
      </div>

      <div className="faq-question" id="where-can-i-suggest">
        <h3>{t('Where can I suggest an improvement or new feature?')}</h3>
        <Trans t={rawT} ns="pages">
          Trustroots is under active development again. Small improvements and
          fixes are welcome in our{' '}
          <a href="https://github.com/Trustroots/trustroots/issues">
            GitHub issues
          </a>
          . Larger product changes are focused on{' '}
          <a href="https://nos.trustroots.org/">Nostroots</a>.
        </Trans>
      </div>
    </Faq>
  );
}

FaqBugsAndFeatures.propTypes = {};
