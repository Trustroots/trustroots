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
            MIT License
          </a>
          .
        </Trans>
      </div>

      <div className="faq-question" id="im-a-developer">
        <h3>{t("I'm a developer and I want to help!")}</h3>
        <Trans t={t} ns="pages">
          Great! Read about{' '}
          <a href="http://team.trustroots.org/">development</a> and get in touch
          with us! We are looking for JavaScript developers (back- and frontend)
          and sysops.
        </Trans>
      </div>

      <div className="faq-question" id="are-you-planning-to-do-x-feature">
        <h3>{t('Are you planning to do X feature?')}</h3>
        <Trans t={t} ns="pages">
          See{' '}
          <a href="https://github.com/Trustroots/trustroots/projects/1">
            our roadmap
          </a>{' '}
          for our current todolist. Feel free to <a href="/support">tell us</a>{' '}
          about your ideas! The current version of Trustroots is the most
          limited software you can imagine that still works for hospitality. We
          simply haven&apos;t had time to build most of the features yet. Please
          be patient and be mindful about{' '}
          <a href="http://www.productstrategymeanssayingno.com/">
            feature creep
          </a>
          .
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

      <div className="faq-question" id="f-droid">
        <h3>{t('Could you offer mobile app at F-Droid store?')}</h3>
        <Trans t={t} ns="pages">
          We would love to! However, it seems we cannot because of how our
          mobile app is built.
          <br />
          <br />
          We don&apos;t have resources yet to build a separate &quot;native
          app&quot; for Android so we&apos;re using{' '}
          <a href="https://expo.io/">Expo.io</a> framework instead.
        </Trans>
        <br />
        <br />
        <Trans t={t} ns="pages">
          Using Expo{' '}
          <a href="https://forum.f-droid.org/t/expo-and-react-native-apps/701">
            seems to block
          </a>{' '}
          inclusion to F-Droid, although we don&apos;t directly use any of the
          services mentioned in the blocking list but Expo itself might. Expo is
          an <a href="https://github.com/expo">open source</a> project. <br />
        </Trans>
        <br />
        <Trans t={t} ns="pages">
          However, you can simply download our apk file manually:{' '}
          <a href="http://apk.trustroots.org">apk.trustroots.org</a> — this
          version might not support all the features though, such as push
          notifications.
        </Trans>
        <br />
        <br />
        <Trans t={t} ns="pages">
          If you would like to help solve this,{' '}
          <a href="https://github.com/Trustroots/trustroots-expo-mobile">
            get in touch!
          </a>
        </Trans>
      </div>
    </Faq>
  );
}

FaqTechnology.propTypes = {};
