import React from 'react';
import Faq from '@/modules/pages/client/components/Faq.component.js';
import { Trans, useTranslation } from 'react-i18next';

export default function FaqGeneral() {
  const { t } = useTranslation('pages');

  return (
    <Faq category="general">
      <div
        className="faq-question"
        id="is-trustroots-exclusively-for-hitchhikers"
      >
        <h3>{t('Is Trustroots exclusively for hitchhikers?')}</h3>
        {t('No. Trustroots is for everyone.')}
        <br />
        <br />
        {t(
          "Trustroots was initially built with hitchhikers in mind but anyone has always been welcome to sign up even if they've never hitchhiked.",
        )}
        <br />
        <br />
        <Trans t={t} ns="pages">
          In the initial phase we were focusing on getting especially
          hitchhikers on board and making the site ideal for that. Our
          background is within Hitchhikers community and in{' '}
          <a href="https://hitchwiki.org/">Hitchwiki</a>. The site will
          obviously remain rather alternative and true to its roots, even when
          we introduce it to new communities. <br />
        </Trans>
        <br />
        <a href="/faq/tribes">{t('Read more about circles')}</a>.
      </div>

      <div className="faq-question" id="what-is-your-long-term-vision">
        <h3>{t('What is your long term vision?')}</h3>
        <em>
          {t(
            '"We want a world that encourages trust, adventure and intercultural connections."',
          )}
        </em>
        <a href="/foundation">{t('Read more')}</a>.
      </div>

      <div className="faq-question" id="is-there-mobile-app">
        <h3>{t('Is there a mobile app?')}</h3>
        {t(
          'No. There used to be an android app, but it is no longer maintained and not available.',
        )}
        <br />
        <br />
        <Trans t={t} ns="pages">
          However, our website is mobile optimized, so you could also add it to
          your phone&apos;s home screen for quick access. Here are instructions
          for{' '}
          <a
            href="https://www.wikihow.com/Add-a-Link-Button-to-the-Home-Screen-of-an-iPhone"
            rel="noopener"
          >
            iOS
          </a>
          ,{' '}
          <a
            href="https://www.wikihow.com/Set-a-Bookmark-Shortcut-in-Your-Home-Screen-on-Android#Using_Chrome_for_Android_sub"
            rel="noopener"
          >
            Android (Chrome)
          </a>{' '}
          and{' '}
          <a
            href="https://www.wikihow.com/Set-a-Bookmark-Shortcut-in-Your-Home-Screen-on-Android#Using_Firefox_sub"
            rel="noopener"
          >
            Android (Firefox)
          </a>
          . <br />
        </Trans>
      </div>

      <div className="faq-question" id="is-trustroots-alternative">
        <h3>
          {t('Is Trustroots an alternative for CouchSurfing or BeWelcome?')}
        </h3>
        {t(
          "Trustroots isn't on purpose an alternative to anything specifically. There are many people to whom Facebook, CouchSurfing or other tools aren't suitable for multitude of reasons. We encourage using any tools you wish in parallel. We are trying to make it easy to gather your contents from these sites also to Trustroots.",
        )}
      </div>

      <div
        className="faq-question"
        id="how-is-this-connected-to-hitchwiki-nomadwiki-or-trashwiki"
      >
        <h3>
          {t('How is this connected to Hitchwiki, Nomadwiki or Trashwiki?')}
        </h3>
        {t(
          'The team creating Trustroots also created these projects. We have done heavy linking between the projects since they share pretty much the same vision and user base.',
        )}
      </div>

      <div className="faq-question" id="why-the-name-trustroots">
        <h3>{t('Why the name Trustroots?')}</h3>
        {t(
          "Back to the roots. Earthy. The art of asking — and trusting — is something we often experience while traveling. We also have some innovative ideas that can help building trust among people. Once the network is big enough we'd love to work with scientists to build something that can really make a difference through trust metrics.",
        )}
      </div>

      <div className="faq-question" id="why-is-there-facebook-connection">
        <h3>{t('Why is there Facebook connection?')}</h3>
        {t(
          'So that people who have their data, photos and connections on Facebook can release their information to Trustroots. Using Facebook from Trustroots is optional.',
        )}{' '}
        <Trans t={t} ns="pages">
          <a href="https://ideas.trustroots.org/2014/12/29/life-outside-big-blue-box/">
            Read our blog post
          </a>{' '}
          about this.
        </Trans>
      </div>

      <div className="faq-question" id="why-is-there-no-forum">
        <h3>{t('Why is there no forum?')}</h3>
        {t(
          'The practical answer: it takes time to set up a forum and even more time to keep it spam-free. The less practical answer: In our long-term and short-term experience forum activity is not necessarily the best way to get to more real life interactions. In the long term we do want to provide a way to communicate on the site, but this will probably look more like the quick and easy way you can interact on Facebook or Diaspora than a full fledged forum.',
        )}
        <br />
        <br />
        <Trans t={t} ns="pages">
          Do <a href="/contact">contact us</a> if you want to help with this.
        </Trans>
      </div>

      <div className="faq-question" id="why-was-my-account-suspended">
        <h3>{t('Why was my account suspended?')}</h3>
        <Trans t={t} ns="pages">
          See <a href="/rules">rules of Trustroots</a> for details.
        </Trans>
      </div>

      <div className="faq-question" id="how-can-i-remove-my-account">
        <h3>{t('How can I remove my account')}</h3>
        <Trans t={t} ns="pages">
          You can remove your account via{' '}
          <a href="/profile-edit/account#remove">account page</a>. We will not
          store your profile in our systems after removal.
        </Trans>
      </div>

      <div className="faq-question" id="how-can-i-help">
        <h3>{t('How can I help?')}</h3>
        <Trans t={t} ns="pages">
          Trustroots is a community of travellers for sharing, hosting and
          getting people together. If you want to help grow this network you can
          find some <a href="/volunteering">things to do here</a>.
        </Trans>
      </div>

      <div className="faq-question" id="how-can-i-contact-you">
        <h3>{t('How can I contact you?')}</h3>
        <Trans t={t} ns="pages">
          In plenty of public and private ways:{' '}
          <a href="/support">drop us a message</a>,{' '}
          <a href="https://ideas.trustroots.org/">comment on our blog</a>,{' '}
          <a href="https://github.com/Trustroots/trustroots/issues">
            report bugs at GitHub
          </a>
          , reach out via <a href="https://twitter.com/trustroots">Twitter</a>{' '}
          or <a href="https://www.facebook.com/trustroots.org/">Facebook</a> and
          to directly contact individuals, see <a href="/team">the team </a>{' '}
          page.
        </Trans>
      </div>

      <div
        className="faq-question"
        id="how-do-i-report-a-member-that-violates-the-rules"
      >
        <h3>{t('How do I report a member that violates the rules?')}</h3>
        <Trans t={t} ns="pages">
          If you navigate to the profile of a user, you will find a link that
          says &quot;Report member&quot; that will lead you to a report form.
          Also, at any point, you can <a href="/support">contact us</a> with
          your report.
        </Trans>
      </div>
    </Faq>
  );
}

FaqGeneral.propTypes = {};
