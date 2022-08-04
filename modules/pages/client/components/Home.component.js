// External dependencies
import { Trans, useTranslation } from 'react-i18next';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';

// Internal dependencies
import { getCircleBackgroundStyle } from '@/modules/tribes/client/utils';
import { getRouteParams } from '@/modules/core/client/services/angular-compat';
import { userType } from '@/modules/users/client/users.prop-types';
import * as circlesAPI from '@/modules/tribes/client/api/tribes.api';
import Board from '@/modules/core/client/components/Board.js';
import BoardCredits from '@/modules/core/client/components/BoardCredits.js';
import ManifestoText from './ManifestoText.component.js';
import Screenshot from '@/modules/core/client/components/Screenshot.js';
import screenshotProfilePng from '../img/screenshot-profile.png';
import screenshotProfilePng2x from '../img/screenshot-profile-2x.png';
import screenshotProfileWebp from '../img/screenshot-profile.webp';
import screenshotProfileWebp2x from '../img/screenshot-profile-2x.webp';
import screenshotSearchPng from '../img/screenshot-search.png';
import screenshotSearchPng2x from '../img/screenshot-search-2x.png';
import screenshotSearchWebp from '../img/screenshot-search.webp';
import screenshotSearchWebp2x from '../img/screenshot-search-2x.webp';
import Tooltip from '@/modules/core/client/components/Tooltip.js';

/**
 * List of photos to randomly pick as cover photo for homepage
 *
 * @param  {[String]} circleSlug Slug of circle.
 * @return {Array}
 */
function getBoardPictures(circleSlug) {
  // Default photos
  let boards = [
    'woman-bridge',
    'rainbowpeople',
    'hitchroad',
    'hitchgirl1',
    'wavewatching',
    'sahara-backpacker',
    'hitchtruck',
  ];

  // Different set of photos for cyclists circle
  if (circleSlug === 'cyclists') {
    boards = ['cyclist'];
  }

  // Different set of photos for these 3 circles
  if (
    circleSlug &&
    ['hitchhikers', 'dumpster-divers', 'punks'].includes(circleSlug)
  ) {
    boards = [
      'rainbowpeople',
      'hitchroad',
      'desertgirl',
      'hitchgirl1',
      'hitchgirl2',
      'hitchtruck',
    ];
  }

  return boards;
}

/**
 * Signup URL appended with circle if available
 *
 * @param  {[String]} circleSlug Slug of circle.
 * @return {String} Signup URL
 */
export function getSignupUrl(circleSlug) {
  if (circleSlug) {
    // @TODO: change `tribe` to `circle`, needs changes in Signup form controller
    return `/signup?tribe=${circleSlug}`;
  }

  return '/signup';
}

export default function Home({ user, isNativeMobileApp, photoCredits }) {
  const { t } = useTranslation('pages');
  // `tribe` route supported for legacy reasons, deprecated Feb 2021
  const { circle: circleRouteParam, tribe: tribeRouteParam } = getRouteParams();
  const circleRoute = circleRouteParam || tribeRouteParam;

  // @TODO change this to be based on UI language rather than browser locale
  const memberCount = new Intl.NumberFormat().format(80000);

  // TODO get header height instead of magic number 56
  // const headerHeight = angular.element('#tr-header').height() || 0; // code of the original angular controller
  const headerHeight = 56;

  const boardHeight =
    window.innerWidth <= 480 && window.innerHeight < 700
      ? 400
      : window.innerHeight - headerHeight + 14;

  const boards = getBoardPictures(circleRoute);

  const [circles, setCircles] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const circles = await circlesAPI.read({ limit: 3 });
      const circleIsLoaded = circles.some(t => t.slug === circleRoute);

      if (circleRoute && !circleIsLoaded) {
        const extraCircle = await circlesAPI.get(circleRoute);

        if (extraCircle && extraCircle._id) {
          circles.unshift(extraCircle);
        }
      }
      setCircles(circles);
    }
    fetchData();
  }, []);

  return (
    <>
      {!user && (
        // TODO apply tr-boards-ignore-small attribute here and implement functionality in the Board.js controller
        <Board
          className="board-primary container home-intro"
          names={boards}
          style={{
            height: boardHeight,
          }}
        >
          <div className="middle-wrapper middle-wrapper-horizontal">
            <div className="middle-content">
              <div className="row">
                <div className="col-xs-12 col-sm-8 col-sm-offset-2">
                  <img
                    className="home-logo hidden-xs center-block"
                    src="/img/logo/white.svg"
                    alt="Trustroots"
                    width="210"
                    height="210"
                    aria-hidden="true"
                  />
                  <img
                    className="home-logo visible-xs-block center-block"
                    src="/img/logo/white.svg"
                    alt="Trustroots"
                    width="130"
                    height="130"
                    aria-hidden="true"
                  />
                  <h1 className="sr-only">Trustroots</h1>
                  <h3 className="home-tagline">{t("Travellers' community")}</h3>
                  <h4 className="home-subtagline">
                    {t('Sharing, hosting and getting people together.')}
                  </h4>
                  <a
                    href={getSignupUrl(circleRoute)}
                    className="btn btn-action btn-default home-join hidden-xs"
                  >
                    {t('Join Trustroots now')}
                  </a>
                  {!isNativeMobileApp && (
                    <div className="home-apps">
                      <a
                        href="https://play.google.com/store/apps/details?id=org.trustroots.trustrootsApp"
                        rel="noopener"
                        className="btn btn-lg btn-default"
                      >
                        <i className="icon-android"></i>
                        {t('Play Store')}
                      </a>
                      <a
                        href="https://ideas.trustroots.org/please-let-know-ios-app-comes-out/"
                        rel="noopener"
                        className="btn btn-lg btn-default"
                      >
                        <i className="icon-apple"></i>
                        {t('App Store')}
                      </a>
                    </div>
                  )}
                  <div className="home-down hidden-xs">
                    <i className="icon-down"></i>
                  </div>
                </div>
              </div>
              {/* .row */}
            </div>
          </div>
        </Board>
      )}

      {/* How does it work */}
      <section className="home-how">
        <div className="container">
          <div className="row">
            <div className="col-md-5 text-center lead">
              <div className="icon-sofa icon-3x text-muted"></div>
              <br />
              <h2 className="font-brand-light">{t('How does it work?')}</h2>
              <br />
              <p className="font-brand-light">
                {t(
                  `Have a look! Travel anywhere and easily find great people who want to
                meet you as well. See where other travellers are and help each other
                out, whether through welcoming them to your home, sharing your stories
                or becoming friends.`,
                )}
                <br />
                <br />
                {/* @TODO remove ns (issue #1368) */}
                <Trans t={t} ns="pages" values={{ memberCount }}>
                  Trustroots is over{' '}
                  <a href="/statistics">{{ memberCount }} members</a> strong and
                  growing!
                </Trans>
              </p>
            </div>
            <div aria-hidden className="col-md-7">
              <Screenshot
                png={screenshotSearchPng}
                png2x={screenshotSearchPng2x}
                webp={screenshotSearchWebp}
                webp2x={screenshotSearchWebp2x}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Share */}
      <section className="home-how">
        <div className="container">
          <div className="row">
            <div aria-hidden className="col-xs-12 col-md-7 hidden-xs hidden-sm">
              <Screenshot
                png={screenshotProfilePng}
                png2x={screenshotProfilePng2x}
                webp={screenshotProfileWebp}
                webp2x={screenshotProfileWebp2x}
              />
            </div>
            <div className="col-xs-12 col-sm-offset-2 col-sm-8 col-md-offset-0 col-md-5 text-center lead">
              <div className="home-wohoo center-block hidden-xs hidden-sm"></div>
              <p className="font-brand-light">
                <br className="hidden-xs hidden-sm" />
                {t('Share the beautiful you with the world.')}
                <br />
                <br />
                {t(`Put yourself in the shoes of others: what would you like to know about
                your travel buddies? What should they know about you?`)}
                <br />
                <br />
                {t('Be genuine yourself.')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {circles.length > 0 && (
        <section className="home-how">
          <div className="container">
            <div className="row">
              <div className="col-xs-10 col-xs-push-1 col-sm-3 col-sm-push-6">
                <div className="text-center tribe-intro">
                  <h2 className="font-brand-light">{t('Circles')}</h2>
                  <p className="font-brand-light">
                    {t(`Joining circles helps you find likeminded Trustroots members and
                  tells others what you're interested in.`)}
                    <br />
                    <br />
                    <a href="/circles" className="btn btn-default btn-lg">
                      {t('More circles')}
                    </a>
                  </p>
                </div>
              </div>
              <div className="col-xs-12 visible-xs tribes-xs">
                {circles.slice(0, 3).map(circle => (
                  <a
                    key={circle._id}
                    href={`/circles/${circle.slug}`}
                    className="img-circle tribe-xs tribe-image"
                    style={getCircleBackgroundStyle(circle, '742x496')}
                  >
                    {!circle.image && <span>{circle.label.charAt(0)}</span>}
                  </a>
                ))}
              </div>
              {circles.slice(0, 3).map((circle, index, items) => (
                <div
                  key={circle._id}
                  className={classnames('col-sm-3', 'hidden-xs', {
                    'col-sm-pull-3': index < items.length - 1,
                  })}
                >
                  <div
                    className="img-circle tribe tribe-image"
                    style={getCircleBackgroundStyle(circle, '742x496')}
                  >
                    <a href={`/circles/${circle.slug}`} className="tribe-link">
                      <h3 className="tribe-label">{circle.label}</h3>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Manifesto */}
      <Board
        className="board-primary board-inset"
        names="mountainforest"
        id="manifesto"
      >
        <div className="container">
          <div className="row">
            <div className="col-md-offset-3 col-md-6 text-center lead font-brand-light">
              <ManifestoText></ManifestoText>
              {!user && (
                <p>
                  <br />
                  <br />
                  <a
                    href={getSignupUrl(circleRoute)}
                    className="btn btn-lg btn-action btn-default"
                  >
                    {t('Join Trustroots')}
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
      </Board>

      {/* Footer */}
      <Board
        className="board-primary board-inset home-footer"
        names="bokeh"
        ignoreBackgroundOnSmallScreen
      >
        <div className="container">
          <div className="row">
            <div className="col-sm-6 col-md-3">
              <h3 className="font-brand-light">{t('Foundation')}</h3>
              <p>
                {t(`Owned and operated by Trustroots Foundation, a non-profit registered
                in the United Kingdom since March 2015.`)}
              </p>
              <p>
                <i className="icon-right"></i>
                <a
                  href="/foundation"
                  className="home-footer-more font-brand-semibold"
                >
                  {t('Learn more')}
                </a>
              </p>
            </div>
            <div className="col-sm-6 col-md-3">
              <h3 className="font-brand-light">{t('Team')}</h3>
              <p>
                {/* @TODO remove ns (issue #1368) */}
                <Trans t={t} ns="pages">
                  Trustroots is being built by a small team of activists who
                  felt that the world of sharing is being taken over by
                  corporations trying to monetize people&apos;s willingness to
                  help each other. Same team brought you also{' '}
                  <a href="https://hitchwiki.org/">Hitchwiki</a>,{' '}
                  <a href="https://trashwiki.org/">Trashwiki</a> and{' '}
                  <a href="https://nomadwiki.org/">Nomadwiki</a>.
                </Trans>
              </p>
              <p>
                <i className="icon-right"></i>
                <a
                  href="/team"
                  className="home-footer-more font-brand-semibold"
                >
                  {t('Meet the team')}
                </a>
              </p>
            </div>
            <div className="col-sm-6 col-md-3">
              <h3 className="font-brand-light">{t('Free and open source')}</h3>
              <p>
                {t(`We think it's a shame that former non profits have been sold to
                venture capital. We've been running other notable free and open
                projects for a decade now and we hope our deeds so far speak for us.`)}
              </p>
              <p>
                <i className="icon-right"></i>
                <a
                  href="http://team.trustroots.org/"
                  className="home-footer-more font-brand-semibold"
                >
                  {t('For developers')}
                </a>
              </p>
            </div>
            <div className="col-sm-6 col-md-3">
              <ul className="list-unstyled home-footer-pages font-brand-light">
                <li>
                  <a href="/faq">{t('FAQ')}</a>
                </li>
                <li>
                  <a href="https://ideas.trustroots.org/">{t('Blog')}</a>
                </li>
                <li>
                  <a href="/volunteering">{t('Volunteering')}</a>
                </li>
                <li>
                  <a href="/media">{t('Media')}</a>
                </li>
                <li>
                  <a href="/support">{t('Contact & support')}</a>
                </li>
              </ul>
            </div>
          </div>

          <div className="row text-center">
            <hr className="hr-white hr-xs" />
            {!isNativeMobileApp && (
              <div className="home-apps">
                <a
                  href="https://play.google.com/store/apps/details?id=org.trustroots.trustrootsApp"
                  rel="noopener"
                  className="btn btn-lg btn-default"
                >
                  <i className="icon-android"></i>
                  {t('Play Store')}
                </a>
                <a
                  href="https://ideas.trustroots.org/please-let-know-ios-app-comes-out/"
                  rel="noopener"
                  className="btn btn-lg btn-default"
                >
                  <i className="icon-apple"></i>
                  {t('App Store')}
                </a>
              </div>
            )}
            <ul className="list-inline home-footer-some">
              <li>
                <Tooltip id="facebook-tooltip" tooltip="Facebook">
                  <a
                    href="https://www.facebook.com/trustroots.org"
                    aria-label={t('Trustroots at Facebook')}
                  >
                    <i className="icon-facebook icon-lg"></i>
                  </a>
                </Tooltip>
              </li>
              <li>
                <Tooltip id="facebook-tooltip" tooltip="Twitter">
                  <a
                    href="https://twitter.com/trustroots"
                    aria-label={t('Trustroots at Twitter')}
                  >
                    <i className="icon-twitter icon-lg"></i>
                  </a>
                </Tooltip>
              </li>
              <li>
                <Tooltip id="instagram-tooltip" tooltip="Instagram">
                  <a
                    href="https://www.instagram.com/trustroots/"
                    aria-label={t('Trustroots at Instagram')}
                  >
                    <i className="icon-instagram icon-lg"></i>
                  </a>
                </Tooltip>
              </li>
              <li>
                <Tooltip id="github-tooltip" tooltip="GitHub">
                  <a
                    href="https://github.com/Trustroots/trustroots"
                    aria-label={t('Trustroots at GitHub')}
                  >
                    <i className="icon-github icon-lg"></i>
                  </a>
                </Tooltip>
              </li>
            </ul>

            <BoardCredits photoCredits={photoCredits} />
          </div>
          {/* .row */}
        </div>
        {/* /.container */}
      </Board>
    </>
  );
}

Home.propTypes = {
  user: userType,
  isNativeMobileApp: PropTypes.bool,
  photoCredits: PropTypes.object,
};
