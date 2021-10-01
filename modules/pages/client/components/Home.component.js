// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';

// Internal dependencies
import { getRouteParams } from '@/modules/core/client/services/angular-compat';
import { userType } from '@/modules/users/client/users.prop-types';
import * as circlesAPI from '@/modules/tribes/client/api/tribes.api';
import Board from '@/modules/core/client/components/Board.js';
import { brandName } from '@/modules/core/client/utils/constants';

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

export default function Home({ user, isNativeMobileApp }) {
  const { t } = useTranslation('pages');
  // `tribe` route supported for legacy reasons, deprecated Feb 2021
  const { circle: circleRouteParam, tribe: tribeRouteParam } = getRouteParams();
  const circleRoute = circleRouteParam || tribeRouteParam;

  // @TODO change this to be based on UI language rather than browser locale

  // TODO get header height instead of magic number 56
  // const headerHeight = angular.element('#tr-header').height() || 0; // code of the original angular controller
  const headerHeight = 56;

  const boardHeight =
    window.innerWidth <= 480 && window.innerHeight < 700
      ? 400
      : window.innerHeight - headerHeight + 14;

  const boards = getBoardPictures(circleRoute);

  const [, setCircles] = useState([]);

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
                    src="/img/logo/Placeholder_view_vector.svg"
                    alt="Trustroots"
                    width="210"
                    height="210"
                    aria-hidden="true"
                  />
                  <img
                    className="home-logo visible-xs-block center-block"
                    src="/img/logo/Placeholder_view_vector.svg"
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
                    {t('Join {{brandName}} now', {
                      brandName,
                    })}
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
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

Home.propTypes = {
  user: userType,
  isNativeMobileApp: PropTypes.bool,
  photoCredits: PropTypes.object,
};
