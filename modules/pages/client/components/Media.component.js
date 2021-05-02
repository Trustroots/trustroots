import React from 'react';
import Board from '@/modules/core/client/components/Board.js';
import { Trans, useTranslation } from 'react-i18next';

export default function Media() {
  const { t } = useTranslation('pages');

  const mediaDate = (...dateArgs) =>
    t('{{date, MMMM Do}}', { date: new Date(...dateArgs) });

  return (
    <>
      <Board names="bokeh">
        <div className="container">
          <div className="row">
            <div className="col-xs-12 text-center">
              <br />
              <br />
              <h2 className="visible-xs-block">{t('Media')}</h2>
              <h2 className="hidden-xs">
                <img
                  src="/img/tree-white.svg"
                  alt="Trustroots"
                  width="75"
                  height="75"
                />{' '}
                {t('in Media')}
              </h2>
              <br />
              <br />
              <p className="lead">
                {t(
                  'Trustroots is a new non-profit hospitality exchange community.',
                )}
              </p>
            </div>
          </div>
        </div>
      </Board>

      <section className="container container-spacer">
        <div className="row">
          <div className="col-xs-12 col-sm-offset-1 col-sm-10 col-md-offset-2 col-md-8">
            <h3 id="in-media">{t('Trustroots in Media')}</h3>

            <h4 className="media-list-divider text-muted">2020</h4>
            <dl className="dl-horizontal media-list">
              <dt>
                <span className="text-muted">
                  {/* June 24th */}
                  {mediaDate(2020, 5, 24)}
                </span>
                <br />
                Nikkei Asia
              </dt>
              <dd>
                <h4>
                  <a href="https://asia.nikkei.com/Editor-s-Picks/Tea-Leaves/Pandemic-hits-couchsurfing-travel-bug">
                    Pandemic hits &quot;couchsurfing&quot; travel bug
                  </a>
                </h4>
              </dd>
            </dl>

            <h4 className="media-list-divider text-muted">2017</h4>
            <dl className="dl-horizontal media-list">
              <dt>
                <span className="text-muted">
                  {/* October 13th */}
                  {mediaDate(2017, 9, 13)}
                </span>
                <br />
                The Daily Dot
              </dt>
              <dd>
                <h4>
                  <a href="https://www.dailydot.com/debug/new-couchsurfing/">
                    Why hasn’t there been a new Couchsurfing?
                  </a>
                </h4>
              </dd>

              <dt>
                <span className="text-muted">
                  {/* September 25th */}
                  {mediaDate(2017, 8, 25)}
                </span>
                <br />
                RSI Rete Uno ({t('Radio')})
              </dt>
              <dd>
                <h4>
                  <a href="https://www.rsi.ch/rete-uno/programmi/intrattenimento/tutorial/Vi-fidate-ancora-dell%E2%80%99autostop-9485278.html">
                    Vi fidate ancora dell’autostop?
                  </a>
                </h4>
                <small className="text-muted">
                  {t('In Italian. 2nd audio track from 10:50 to 25:00.')}
                </small>
              </dd>

              <dt>
                <span className="text-muted">
                  {/* July 17th */}
                  {mediaDate(2017, 6, 17)}
                </span>
                <br />
                Freestyle Travelshow ({t('podcast')})
              </dt>
              <dd>
                <h4>
                  <a href="http://www.freestyletravelshow.com/2017/07/12-trustroots-w-mikael.html">
                    Trustroots w/ Mikael
                  </a>
                </h4>
              </dd>

              <dt>
                <span className="text-muted">
                  {/* April 3rd */}
                  {mediaDate(2017, 3, 3)}
                </span>
                <br />
                Freestyle Travelshow ({t('podcast')})
              </dt>
              <dd>
                <h4>
                  <a href="http://www.freestyletravelshow.com/2017/04/3-couchsurfing-and-hospitality-networks.html">
                    Couchsurfing and Hospitality Networks
                  </a>
                </h4>
                <small className="text-muted">({t('from 37:00')})</small>
              </dd>
            </dl>
            <h4 className="media-list-divider text-muted">2016</h4>
            <dl className="dl-horizontal media-list">
              <dt>
                <span className="text-muted">
                  {/* January 13th */}
                  {mediaDate(2016, 0, 13)}
                </span>
                <br />
                Helsingin Sanomat
              </dt>
              <dd>
                <h4>
                  <a href="http://www.hs.fi/matka/art-2000002879498.html?share=f87e8dfd114a125de07a9e980dcf3cb1">
                    Sohvasurffauksen takia uskon, ettei maailma ole pilalla
                  </a>
                </h4>
                <small className="text-muted">{t('In Finnish.')}</small>
              </dd>
            </dl>
            <h4 className="media-list-divider text-muted">2015</h4>
            <dl className="dl-horizontal media-list">
              <dt>
                <span className="text-muted">
                  {/* Jul 22nd */}
                  {mediaDate(2015, 6, 22)}
                </span>
                <br />
                MO — Mondiaal Nieuws
              </dt>
              <dd>
                <h4>
                  <a href="http://www.mo.be/analyse/vergeet-airbnb-dit-is-het-echte-en-gratis-deelreizen">
                    Vergeet Airbnb, dit is het echte en gratis deelreizen
                  </a>
                </h4>
                <small className="text-muted">{t('In Dutch.')}</small>
              </dd>

              <dt>
                <span className="text-muted">
                  {/* Jun 12th */}
                  {mediaDate(2015, 5, 12)}
                </span>
                <span className="text-muted">{t('')}</span>
                <br />
                MatadorNetwork
              </dt>
              <dd>
                <h4>
                  <a href="http://matadornetwork.com/bnt/couchsurfings-destiny-doomed/">
                    Why Couchsurfing’s destiny is doomed
                  </a>
                </h4>
              </dd>

              <dt>
                <span className="text-muted">
                  {/* May 24th */}
                  {mediaDate(2015, 4, 24)}
                </span>
                <br />
                Kernelmag-Dailydot
              </dt>
              <dd>
                <h4>
                  <a href="http://kernelmag.dailydot.com/issue-sections/features-issue-sections/13124/life-and-death-couchsurfing/">
                    The improbable rise and fall of Couchsurfing
                  </a>
                </h4>
              </dd>

              <dt>
                <span className="text-muted">
                  {/* Apr 19th */}
                  {mediaDate(2015, 3, 19)}
                </span>
                <br />
                Frankfurter Allgemeine Zeitung
              </dt>
              <dd>
                <h4>
                  <a href="https://ideas.trustroots.org/wordpress/wp-content/uploads/2015/04/FAS-170415-V3_Sofasurf.pdf">
                    Sofa So Good
                  </a>
                </h4>
                <small className="text-muted">
                  {t('In German.')}{' '}
                  <a href="https://ideas.trustroots.org/2015/04/23/frankfurter-allgemeine-zeitung-article-in-german/">
                    {t('Our response.')}
                  </a>
                </small>
              </dd>

              <dt>
                <span className="text-muted">
                  {/* Jan 29th */}
                  {mediaDate(2015, 0, 29)}
                </span>
                <br />
                WAZ
              </dt>
              <dd>
                <h4>
                  <a href="http://www.derwesten.de/freizeit/moderne-tramper-sind-im-internet-gut-miteinander-vernetzt-id10255948.html">
                    Moderne Tramper sind im Internet gut miteinander vernetzt
                  </a>
                </h4>
                <small className="text-muted">{t('In German.')}</small>
              </dd>
            </dl>
            <br />
            <h3 id="interviews">{t('Interviews')}</h3>
            <p>
              <Trans t={t} ns="pages">
                <a href="/support">Contact us</a> if you have any questions or
                if you are planning to write about us.
              </Trans>
            </p>
            <p>
              <Trans t={t} ns="pages">
                <a href="/team">We</a> can give interviews in English, German,
                Dutch, French, Spanish &amp; Finnish.
              </Trans>
            </p>
            <br />
            <br />
            <h3 id="fact-sheet">{t('Fact sheet')}</h3>
            <ul>
              <li>
                {t('Launched {{date, LL}}', {
                  // Dec 23rd
                  date: new Date(2014, 11, 23),
                })}
              </li>
              <li>{t('Non-profit & open source')}</li>
              <li>
                {t('Entirely free and operating on basis of gift-economy')}
              </li>
              <li>
                <Trans t={t} ns="pages">
                  Run by <a href="/foundation">Trustroots Foundation</a>
                </Trans>
              </li>
              <li>
                <Trans t={t} ns="pages">
                  Operating costs covered entirely by{' '}
                  <a href="/contribute">donations</a>
                </Trans>
              </li>
              <li>
                <Trans t={t} ns="pages">
                  See <a href="/statistics">statistics</a>
                </Trans>
              </li>
              <li>
                <Trans t={t} ns="pages">
                  Read <a href="faq.general">frequently asked questions</a>
                </Trans>
              </li>
            </ul>
            <br />
            <br />
            <h3 id="files">{t('Files')}</h3>
            <ul className="list-unstyled">
              <li>
                <a href="https://github.com/Trustroots/media/blob/master/style-guide/Trustroots-Styleguide.pdf">
                  {t('Style guide')}
                </a>
              </li>
              <li>
                <a href="https://github.com/Trustroots/media/tree/master/screenshots">
                  {t('Screenshots')}
                </a>
              </li>
              <li>
                <Trans t={t} ns="pages">
                  Download all media files as a{' '}
                  <a href="https://github.com/Trustroots/media/archive/master.zip">
                    zip archive
                  </a>
                </Trans>
              </li>
              <li>
                <em>
                  <Trans t={t} ns="pages">
                    <a href="/support">Ask</a> us for more photos etc
                  </Trans>
                </em>
              </li>
            </ul>
            <br />
            <div className="media" id="logo">
              <div className="media-left">
                <img
                  className="media-object"
                  src="/img/logo/color.svg"
                  alt="Trustroots logo"
                  width="130"
                  height="130"
                />
              </div>
              <div className="media-body">
                <h4 className="media-heading">{t('Trustroots logo')}</h4>
                <ul>
                  <li>
                    <a
                      target="_top"
                      type="image/png"
                      download="trustroots-logo.png"
                      href="https://raw.githubusercontent.com/Trustroots/media/master/logo/logo.png"
                    >
                      PNG
                    </a>{' '}
                    <small className="text-muted">
                      {t('(recommended for websites)')}
                    </small>
                  </li>
                  <li>
                    <a
                      target="_top"
                      type="application/postscript"
                      download="trustroots-logo.ai"
                      href="https://raw.githubusercontent.com/Trustroots/media/master/logo/Vector/Colors/logo.ai"
                    >
                      AI
                    </a>
                  </li>
                  <li>
                    <a
                      target="_top"
                      type="application/eps"
                      download="trustroots-logo.eps"
                      href="https://raw.githubusercontent.com/Trustroots/media/master/logo/Vector/Colors/logo.eps"
                    >
                      EPS
                    </a>
                  </li>
                  <li>
                    <a
                      target="_top"
                      type="image/svg+xml"
                      download="trustroots-logo.svg"
                      href="https://raw.githubusercontent.com/Trustroots/media/master/logo/Vector/Colors/logo.svg"
                    >
                      SVG
                    </a>
                  </li>
                  <li>
                    <a href="https://github.com/Trustroots/media/tree/master/logo">
                      {t('More…')}
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        {/* /.row */}
      </section>
      {/* /.container */}
    </>
  );
}

Media.propTypes = {};
