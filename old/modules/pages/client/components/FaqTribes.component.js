import React from 'react';
import Faq from '@/modules/pages/client/components/Faq.component.js';
import { Trans, useTranslation } from 'react-i18next';

export default function FaqTribes() {
  const { t } = useTranslation('pages');

  return (
    <Faq category="circles">
      <div className="faq-question" id="what-are-circles">
        <h3>{t('What are circles?')}</h3>
        {t(
          'Trustroots circles (previously known as "tribes") are a way for you to immediately find the people you will easily connect with.',
        )}
        <br />
        <br />
        <Trans t={t} ns="pages">
          You can start now by joining <a href="/circles">circles</a> that you
          identify yourself with.
        </Trans>
        <br />
        <br />
        {t('When searching for hosts, you can filter members by circles.')}
        <br />
        <br />
        {t(
          'Your circles will also show up in your profile, telling others more about you.',
        )}
        <br />
        <br />
        {t(
          "We'll aim to add ways to the site that will fill your trips and your life with adventure! Imagine walking around in a city you're visiting for the first time and suddently you start receiving invitations from people to stay with them or go to awesome or inspiring events, or just to a dumpster dive dinner. That's the adventure Trustroots wants to enable. And circles is a step towards this.",
        )}
        <br />
        <br />
        <Trans t={t} ns="pages">
          See also{' '}
          <a href="https://ideas.trustroots.org/2016/05/09/introducing-trustroots-tribes/">
            the blog post
          </a>{' '}
          introducing circles.
        </Trans>
      </div>

      <div className="faq-question" id="no-suitable-circles">
        <h3>{t("I don't find a circle that suits me")}</h3>
        <Trans t={t} ns="pages">
          <a href="/support">Send us</a> new circle ideas! In the future you
          will be able to create new circles by yourself.
        </Trans>
      </div>

      <div className="faq-question" id="tribes-rename-to-circles">
        <h3>{t('Why did you rename "tribes" to "circles"?')}</h3>
        {t(
          'We found the term be problematic for having connotations of colonialism and wanted to switch to a more inclusive term in August 2020.',
        )}
        <br />
        <br />
        <a href="https://ideas.trustroots.org/2020/08/04/introducing-circles/">
          {t('Read more')}
        </a>
      </div>
    </Faq>
  );
}

FaqTribes.propTypes = {};
