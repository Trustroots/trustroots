import React from 'react';
// import ManifestoText from './ManifestoText.component.js';
import Board from '@/modules/core/client/components/Board.js';
import { Trans, useTranslation } from 'react-i18next';
import '@/config/client/i18n';
import classnames from 'classnames';

export default function Home() {
  const { t } = useTranslation('pages');

  // TODO replace mock data with real one
  const boardHeight = 700;
  const app = {
    user: false,
  };

  /*
    - import/use Board component
    - pass in a fixed selection of names into the "names" prop
    - ignore the onDisplayPhoto/onHidePhoto stuff for now
    - ignore the tr-boards-ignore-small stuff
  */

  const $stateParams = { tribe: null };
  const home = {};

  if (
    $stateParams.tribe &&
    ['hitchhikers', 'dumpster-divers', 'punks'].indexOf($stateParams.tribe) > -1
  ) {
    // Photos for these 3 tribes
    home.boards = [
      'rainbowpeople',
      'hitchroad',
      'desertgirl',
      'hitchgirl1',
      'hitchgirl2',
      'hitchtruck',
    ];
  } else {
    home.boards = [
      'woman-bridge',
      'rainbowpeople',
      'hitchroad',
      'hitchgirl1',
      'wavewatching',
      'sahara-backpacker',
      'hitchtruck',
    ];
  }

  return (
    <>
      {!app.user && (
        <Board
          className="board-primary container home-intro"
          names={home.boards}
          // backgroundImage: `url("${photo.imageUrl}")`,
          style={{
            height: boardHeight,
          }}
          // tr-boards="::home.boards"
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
                    href="/signup"
                    className="btn btn-action btn-default home-join hidden-xs"
                  >
                    {t('Join Trustroots now')}
                  </a>
                  {!app.isNativeMobileApp && (
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
                <Trans t={t} ns="pages">
                  Trustroots is over <a href="/statistics">36,000 members</a>{' '}
                  strong!
                </Trans>
              </p>
            </div>
            <div className="col-md-7">
              <div className="home-browser">
                <div className="home-browser-circle"></div>
                <div className="home-browser-circle"></div>
                <div className="home-browser-circle"></div>
                <div className="home-browser-screenshot home-browser-screenshot-search"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Share */}
      <section className="home-how">
        <div className="container">
          <div className="row">
            <div className="col-xs-12 col-md-7 hidden-xs hidden-sm">
              <div className="home-browser">
                <div className="home-browser-circle"></div>
                <div className="home-browser-circle"></div>
                <div className="home-browser-circle"></div>
                <div className="home-browser-screenshot home-browser-screenshot-profile"></div>
              </div>
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

      {/* Tribes */}
      {/* @TODO delete check for home.tribes after real implementetion of tribes API*/}
      {home.tribes && home.tribes.length && (
        <section className="home-how">
          <div className="container">
            <div className="row">
              <div className="col-xs-10 col-xs-push-1 col-sm-3 col-sm-push-6">
                <div className="text-center tribe-intro">
                  <h2 className="font-brand-light">{t('Tribes')}</h2>
                  <p className="font-brand-light">
                    {t(`Joining Tribes helps you find likeminded Trustroots members and
                  tells others what you're interested in.`)}
                    <br />
                    <br />
                    <a href="/tribes" className="btn btn-default btn-lg">
                      {t('More Tribes')}
                    </a>
                  </p>
                </div>
              </div>
              <div className="col-xs-12 visible-xs tribes-xs">
                {home.tribes.slice(0, 2).map(tribe => (
                  <a
                    key={tribe._id}
                    href={`/tribes/${tribe.slug}`}
                    className="img-circle tribe-xs tribe-image"
                    tr-tribe-styles="{{::tribe}}" // TODO
                    tr-tribe-styles-dimensions="520x520" // TODO
                    tr-tribe-styles-quality="lightest" // TODO
                    tr-tribe-styles-progressive="yes" // TODO
                  >
                    {!tribe.image_UUID && <span>{tribe.label.charAt(0)}</span>}
                  </a>
                ))}
              </div>
              {home.tribes.slice(0, 2).map((tribe, index, items) => (
                <div
                  key={tribe._id}
                  className={classnames('col-sm-3', 'hidden-xs', {
                    'col-sm-pull-3': index < items.length - 1,
                  })}
                >
                  <div
                    className="img-circle tribe tribe-image"
                    tr-tribe-styles="{{::tribe}}" // TODO
                  >
                    <a href={`/tribes/${tribe.slug}`} className="tribe-link">
                      <h3 className="tribe-label">{tribe.label}</h3>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Manifesto */}
      <section
        className="board board-primary board-inset"
        tr-boards="'mountainforest'" // TODO
        id="manifesto"
      >
        <div className="container">
          <div className="row">
            <div className="col-md-offset-3 col-md-6 text-center lead font-brand-light">
              {/* TODO inside a div? */}
              {/* <div
                ng-include="~modules/pages/client/views/manifesto-text.client.partial.html" // TODO
              ></div> */}
              {/* <ManifestoText></ManifestoText> */}
              {!app.user && (
                <p>
                  <br />
                  <br />
                  <a
                    href="signup"
                    className="btn btn-lg btn-action btn-default"
                  >
                    {t('Join Trustroots')}
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <section
        className="board board-primary board-inset home-footer"
        tr-boards="'bokeh'" // TODO
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
                  className="home-footer-more font-brand-semibold" // TODO
                >
                  {t('Learn more')}
                </a>
              </p>
            </div>
            <div className="col-sm-6 col-md-3">
              <h3 className="font-brand-light">{t('Team')}</h3>
              <p>
                <Trans t={t} ns="pages">
                  Trustroots is being built by a small team of activists who
                  felt that the world of sharing is being taken over by
                  corporations trying to monetize people&#39;s willingness to
                  help each other. Same team brought you also{' '}
                  <a href="http://hitchwiki.org/">Hitchwiki</a>,{' '}
                  <a href="http://trashwiki.org/">Trashwiki</a> and{' '}
                  <a href="http://nomadwiki.org/">Nomadwiki</a>.
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
                {/* //TODO faq.general url*/}
                <li>
                  <a href="/faq">{t('FAQ')}</a>
                </li>
                <li>
                  <a href="https://ideas.trustroots.org/">{t('Blog')}</a>
                </li>
                <li>
                  <a href="https://shop.trustroots.org/">{t('Shop')}</a>
                </li>
                <li>
                  <a href="/volunteering">{t('Volunteering')}</a>
                </li>
                <li>
                  <a href="/media">{t('Media')}</a>
                </li>
                <li>
                  {/* TODO support url */}
                  <a href="/support">{t('Contact & support')}</a>
                </li>
              </ul>
            </div>
          </div>

          <div className="row text-center">
            <hr className="hr-white hr-xs" />
            {!app.isNativeMobileApp && (
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
                <a
                  href="https://www.facebook.com/trustroots.org"
                  uib-tooltip="Facebook" // TODO
                  aria-label={t('Trustroots at Facebook')}
                >
                  <i className="icon-facebook icon-lg"></i>
                </a>
              </li>
              <li>
                <a
                  href="https://twitter.com/trustroots"
                  uib-tooltip="Twitter" // TODO
                  aria-label={t('Trustroots at Twitter')}
                >
                  <i className="icon-twitter icon-lg"></i>
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/trustroots_org/"
                  uib-tooltip="Instagram" // TODO
                  aria-label={t('Trustroots at Instagram')}
                >
                  <i className="icon-instagram icon-lg"></i>
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Trustroots/trustroots"
                  uib-tooltip="GitHub" // TODO
                  aria-label={t('Trustroots at GitHub')}
                >
                  <i className="icon-github icon-lg"></i>
                </a>
              </li>
            </ul>

            {app.photoCreditsCount && (
              <small className="font-brand-light">
                <span tr-board-credits></span>
              </small>
            )}
          </div>
          {/* .row */}
        </div>
        {/* /.container */}
      </section>
    </>
  );
}

Home.propTypes = {};
