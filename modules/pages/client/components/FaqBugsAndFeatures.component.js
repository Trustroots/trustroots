import React from 'react';
import Faq from '@/modules/pages/client/components/Faq.component.js';
import { Trans, useTranslation } from 'react-i18next';

export default function FaqBugsAndFeatures() {
  const { t } = useTranslation('pages');

  return (
    <Faq category="bugs-and-features">
      <div className="faq-question" id="how-do-i-report-a-bug">
        <h3>{t('How do I report a bug?')}</h3>
        <Trans t={t} ns="pages">
          First of all: thank you for taking the time and making an effort in
          reporting a bug. We have a technical workspace where we document all
          our bugs, suggestions and improvement. If you go to our{' '}
          <a href="https://github.com/Trustroots/trustroots/issues">GitHub</a>{' '}
          you can see all documented issues we currently have.
        </Trans>
        <br />
        <br />
        <Trans t={t} ns="pages">
          Before you go through the trouble of creating a new issue, use the
          search bar to see if there’s already an issue about the bug. You can
          check when it’s created, the responses and who’s working on it.
        </Trans>
        <br />
        <br />
        <Trans t={t} ns="pages">
          If you want to respond or if you need to create a new issue, you have
          to sign up at Github. It takes a few minutes and this way, you’ll get
          an email about any updates or responses. When you create a new issue,
          you’ll see some questions to help us to get a good idea of the issue.
          Fill in as much as you can and submit your issue.
        </Trans>
      </div>

      <div className="faq-question" id="where-can-i-suggest">
        <h3>{t('Where can I suggest an improvement or new feature?')}</h3>
        <Trans t={t} ns="pages">
          We’re always very happy to hear back from the community how we can
          improve our current features or have creative ideas for new ones. Bare
          in mind though all time is donated and we fully rely on volunteers,
          therefore only when we have plenty of volunteers, there’s time to work
          on these kind of suggestions.
        </Trans>
        <br />
        <br />
        <Trans t={t} ns="pages">
          We work on these kind of things in our technical space on{' '}
          <a href="https://github.com/Trustroots/trustroots/issues">GitHub</a>.
          Here you can see everything that is currently documented. First use
          the search bar to see if someone else has submitted already your
          suggestion or if you can find a similar one. You have to create an
          account in order to do so. It takes a few minutes and this way, you’ll
          get an email about any updates or responses.
        </Trans>
        <br />
        <br />
        <Trans t={t} ns="pages">
          In case you can’t find any existing issue about your suggestion, you
          can create a new one. When you create a new issue, you’ll see some
          questions to help us to get a good idea of the issue. Fill in as much
          as you can and submit your issue.
        </Trans>
      </div>
    </Faq>
  );
}

FaqBugsAndFeatures.propTypes = {};
