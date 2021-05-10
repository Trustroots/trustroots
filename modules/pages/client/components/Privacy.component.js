import React from 'react';
import Board from '@/modules/core/client/components/Board.js';
import { userType } from '@/modules/users/client/users.prop-types';
import { Trans, useTranslation } from 'react-i18next';

export default function Privacy({ user }) {
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
              <time itemProp="dateModified" dateTime="2018-12-04">
                {t('Last updated on December 4th, 2018')}
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
              {t(
                'Users on Trustroots can download their profile, contact and hosting data through the',
              )}{' '}
              {!user && <span>{t('Account settings')}</span>}
              {user && <a href="/account">Account settings</a>}
              .
              <br />
              <br />
              {t(
                'You are able to remove your info from the system by asking us to delete your account through the',
              )}{' '}
              {!user && <span>{t('Account settings')}</span>}
              {user && <a href="/account">Account settings</a>}
              .
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
                    'Basic profile information such as name, email, language, name, picture, gender, age, living location, usernames in other networks.',
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
              <p>
                <Trans t={t} ns="pages">
                  Communication with our support team (via e-mail or contact
                  form) is managed via Zendesk and stored on Zendesk servers.
                  You can{' '}
                  <a href="https://www.zendesk.com/company/customers-partners/privacy-policy/">
                    see their privacy policy
                  </a>
                  .
                </Trans>{' '}
                {t(
                  'In the future, we would like to host a support ticket system on our own servers.',
                )}
              </p>
              <h3>{t('Analytics & opting out')}</h3>
              <p>
                {t(
                  'Using Analytics we automatically collect information such as usage times, browser details, screen size, network location (IP), country, language etc. This information is anonymized and never published so that individual users cannot be recognized.',
                )}
              </p>
              <p>
                <Trans t={t} ns="pages">
                  We currently use <strong>Google Analytics</strong>, as
                  it&apos;s the industry standard. At some point in the future
                  we would like to run our own instance of Matomo and after
                  doing that for long enough we may be able to move away from
                  Google Analytics. We can use <a href="/volunteering">help</a>{' '}
                  with this.
                </Trans>
              </p>
              <p>
                {t(
                  'We also use third-party services that probably track usage, this includes',
                )}
              </p>
              <ul>
                <li>{t('Gravatar, for profile images')}</li>
                <li>{t('Facebook, for profile images')}</li>
                <li>
                  <Trans t={t} ns="pages">
                    Google Firebase, for mobile and browser push notifications.
                    Unfortunately there&apos;s no &quot;open source way&quot; of
                    doing push notifications to mobile platforms, they always go
                    through platform&apos;s own servers (basically Apple for
                    iPhone or Google for Android, and each browser vendor for
                    browsers). That&apos;s why if you download the mobile app{' '}
                    <a href="http://apk.trustroots.org/">
                      directly from us as an APK file
                    </a>
                    , you won&apos;t get push notifications.
                  </Trans>
                </li>
              </ul>
              <p>
                <Trans t={t} ns="pages">
                  Like with Google Analytics, we would like to reduce our
                  reliance on these services in the future, and we can
                  definitely use <a href="/volunteering">help</a> with this.
                </Trans>
              </p>
              <br />
              <br />
              <Trans t={t} ns="pages">
                Trustroots uses{' '}
                <a href="https://www.google.com/analytics/">Google Analytics</a>{' '}
                to collect usage, device and browser statistics.
              </Trans>
              <br />
              <br />
              {t('To opt out of analytics tracking, you can either:')}
              <ul>
                <li>
                  <Trans t={t} ns="pages">
                    Install Google&apos;s official{' '}
                    <a href="https://tools.google.com/dlpage/gaoptout">
                      opt out extension
                    </a>
                  </Trans>
                </li>
                <li>
                  <Trans t={t} ns="pages">
                    Install <a href="https://www.ghostery.com/">Ghostery</a>,{' '}
                    <a href="https://addons.mozilla.org/en-US/firefox/addon/noscript/">
                      Noscript
                    </a>
                    , <a href="https://disconnect.me/">Disconnect</a> or{' '}
                    <a href="https://github.com/gorhill/uBlock">uBlock</a>.
                    These browser extensions will disable all known JavaScript
                    trackers and ensure that your browser does not send a
                    request to external tracking servers.
                  </Trans>
                </li>
              </ul>
              {t(
                'If you wish to stay completely anonymous online, please check this guide by Matomo:',
              )}
              <br />
              <a href="https://matomo.org/wp-content/uploads/2012/01/How-to-remain-anonymous-online.pdf">
                How to remain anonymous online? (PDF)
              </a>
              .<h3>{t('Social networks')}</h3>
              {t(
                "Some of the features on Trustroots use other social networks such as Twitter, Facebook, GitHub or Gravatar. You don't have to connect your profile to these and we don't share any data with these networks. We only crawl information you give us access to and show it on your profile if you want to. Some of the data from these sites is then stored on our server.",
              )}
              <br />
              <br />
              {t(
                "Some of our users want to use these networks and they have a right to do so. Others prefer to steer away from these networks and we'll also accommodate these users.",
              )}
              <h3>{t('Your emails')}</h3>
              <Trans t={t} ns="pages">
                We route all our emails using{' '}
                <a href="https://www.sparkpost.com/">SparkPost</a> servers.
              </Trans>
              <h3>{t('Our server')}</h3>
              <Trans t={t} ns="pages">
                Our server (and thus your data) is securely hosted at{' '}
                <a
                  href="https://www.digitalocean.com/?refcode=6dc078966c9c"
                  title="(Referral link)"
                >
                  DigitalOcean
                </a>{' '}
                in Amsterdam, Europe.
              </Trans>
              <h3>{t('Research')}</h3>
              <Trans t={t} ns="pages">
                Scientific trust metric research might be done with Trustroots
                data, but in such case the data is always anonymized and it will
                be impossible to recognize individual users from it. See our{' '}
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
