import React from 'react';
import PropTypes from 'prop-types';
import Faq from '@/modules/pages/client/components/Faq.component.js';
import { Trans, useTranslation } from 'react-i18next';

export default function FaqTribes({ invitationsEnabled }) {
  const { t } = useTranslation('pages');

  return (
    <Faq category="tribes" invitationsEnabled={invitationsEnabled}>
      <div className="faq-question" id="what-are-tribes">
        <h3>{t('What are Tribes?')}</h3>
        {t(
          'Trustroots Tribes are a way for you to immediately find the people you will easily connect with.',
        )}
        <br />
        <br />
        <Trans t={t} ns="pages">
          You can start now by joining <a ui-sref="tribes.list">Tribes</a> that
          you identify yourself with.
        </Trans>
        <br />
        <br />
        {t('When searching for hosts, you can filter members by tribes.')}
        <br />
        <br />
        {t(
          'Your tribes will also show up in your profile, telling others more about you.',
        )}
        <br />
        <br />
        {t(
          "We'll aim to add ways to the site that will fill your trips and your life with adventure! Imagine walking around in a city you're visiting for the first time and suddently you start receiving invitations from people to stay with them or go to awesome or inspiring events, or just to a dumpster dive dinner. That's the adventure Trustroots wants to enable. And Tribes is a step towards this.",
        )}
        <br />
        <br />
        <Trans t={t} ns="pages">
          See also{' '}
          <a href="https://ideas.trustroots.org/2016/05/09/introducing-trustroots-tribes/">
            the blog post
          </a>{' '}
          introducing Tribes.
        </Trans>
      </div>

      <div className="faq-question" id="no-suitable-tribes">
        <h3>{t("I don't find a tribe that suits me")}</h3>
        <Trans t={t} ns="pages">
          <a href="/support">Send us</a> new tribe ideas! In the future you will
          be able to create new tribes by yourself.
        </Trans>
      </div>
    </Faq>
  );
}

FaqTribes.propTypes = {
  invitationsEnabled: PropTypes.bool,
};
