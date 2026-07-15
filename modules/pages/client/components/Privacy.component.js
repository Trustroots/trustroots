import React from 'react';
import Board from '@/modules/core/client/components/Board.js';
import { userType } from '@/modules/users/client/users.prop-types';
import { Trans, useTranslation } from 'react-i18next';

export default function Privacy() {
  const { t } = useTranslation('pages');

  return (
    <>
      <Board names="mountainforest">
        <div className="container">
          <div className="row">
            <div className="col-xs-12 text-center">
              <br />
              <br />
              <h2>{t('Privacy')}</h2>
            </div>
          </div>
        </div>
      </Board>

      <section className="container container-spacer">
        <div className="row">
          <div
            className="col-xs-12 col-sm-offset-1 col-sm-10 col-md-offset-2 col-md-8"
            itemScope
            itemType="http://schema.org/Article"
          >
            <h1 itemProp="name">{t('Trustroots Privacy Policy')}</h1>

            <p
              className="text-muted"
              itemProp="datePublished"
              dateTime="2014-12-23"
            >
              <time itemProp="dateModified" dateTime="2026-07-15">
                {t('Last updated on {{date, LL}}', {
                  date: new Date(2026, 6, 15),
                })}
              </time>
            </p>

            <div itemProp="articleBody">
              <p className="lead">
                <em>
                  {t(
                    'We aim to keep this privacy policy as clear, concise, and easy to understand as possible. We are committed to being transparent and open. This article explains generally how we receive information about you, and what we do with that information once we have it.',
                  )}
                </em>
              </p>
              <h3>{t('Your data is yours')}</h3>
              <Trans t={t} ns="pages">
                Members on Trustroots can download their profile, contact and
                hosting data through the <a href="/account">Account settings</a>
                .
              </Trans>
              <br />
              <br />
              <Trans t={t} ns="pages">
                You are able to remove your profile from the Trustroots by
                asking us to delete your account through the{' '}
                <a href="/account">Account settings</a>.
              </Trans>
              <br />
              <br />
              {t(
                'We will never, ever sell your profile data to anyone or try to otherwise use it commercially.',
              )}
              <h3>{t('Information about you')}</h3>
              {t(
                'This information is collected when you provide it to us (like when you fill your profile) or use features of our service (like messaging).',
              )}
              <br />
              <br />
              <ul>
                <li>
                  {t(
                    'Basic profile information such as name, email, language, picture, gender, age, living location and usernames in other networks.',
                  )}
                </li>
                <li>{t('Messages from and to other members')}</li>
                <li>
                  {t('Information about you from other members; references')}
                </li>
                <li>
                  {t(
                    'Information from 3rd party once you connect your account to them',
                  )}
                </li>
              </ul>
              <p>
                {t(
                  "Via mobile devices you may also share content to Trustroots via your device's camera, location sensor or address book. This data is never published or used without your consent and it is always clarified when you are about to give this information to us.",
                )}
              </p>
              <h3>{t('First-party analytics')}</h3>
              <p>
                {t(
                  'We use a self-hosted instance of Umami, served from 1p.trustroots.org, to understand aggregate use of Trustroots and improve the service. We do not use third-party analytics services.',
                )}
              </p>
              <p>
                {t(
                  'Umami does not use analytics cookies or track people across websites. It records limited information such as pages visited, referrer, browser, operating system, device type and approximate country. We do not use this information to build personal profiles or for advertising, and we do not sell it. Analytics data is stored on infrastructure operated for Trustroots.',
                )}
              </p>
              <h3>{t('Nostroots and Nostr')}</h3>
              <p>
                <Trans t={t} ns="pages">
                  Trustroots offers an optional Nostr integration through
                  Nostroots. Information you publish to Nostr may be stored and
                  redistributed by relays outside Trustroots&apos; control. Your
                  private signing key remains on your device. See the{' '}
                  <a href="https://nos.trustroots.org/privacy/">
                    Nostroots privacy policy
                  </a>{' '}
                  for details.
                </Trans>
              </p>
              <h3>{t('External services')}</h3>
              <p>
                {t(
                  'Some Trustroots features rely on external services. We would like to reduce our reliance on these services in the future.',
                )}
              </p>
              <ul>
                <li>
                  <Trans t={t} ns="pages">
                    Communication with our support team by email or contact form
                    is managed through Zendesk and stored on Zendesk servers.
                    See the{' '}
                    <a href="https://www.zendesk.com/company/customers-partners/privacy-policy/">
                      Zendesk privacy policy
                    </a>
                    .
                  </Trans>
                </li>
                <li>
                  {t(
                    'Gravatar and Facebook may be used for profile images or information you choose to connect to your Trustroots profile.',
                  )}
                </li>
                <li>
                  <Trans t={t} ns="pages">
                    We route our emails through{' '}
                    <a href="https://www.sparkpost.com/">SparkPost</a> servers.
                  </Trans>
                </li>
              </ul>
              <h3>{t('Our server')}</h3>
              <Trans t={t} ns="pages">
                Our server (and thus your data) is securely hosted at Hetzner in
                Germany.
              </Trans>
              <h3>{t('Research')}</h3>
              <Trans t={t} ns="pages">
                Scientific trust metric research might be done with Trustroots
                data, but in such case the data is always anonymized. See our{' '}
                <a href="/statistics">statistics page</a> for more information.
              </Trans>
            </div>
            <hr />
            <p className="lead">
              <Trans t={t} ns="pages">
                Questions? <a href="/support">Drop us a line!</a>
              </Trans>
            </p>
            <p>
              <small className="text-muted">
                <Trans t={t} ns="pages">
                  Content available under a{' '}
                  <a
                    href="https://creativecommons.org/licenses/by-sa/4.0/"
                    className="text-muted"
                  >
                    Creative Commons licence
                  </a>
                </Trans>
                .
              </small>
            </p>
          </div>
        </div>
        {/* /.row */}
      </section>
      {/* /.container */}
    </>
  );
}

Privacy.propTypes = {
  user: userType,
};
