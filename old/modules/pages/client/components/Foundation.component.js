// External dependencies
import { Trans, useTranslation } from 'react-i18next';
import React from 'react';

// Internal dependencies`
import { userType } from '@/modules/users/client/users.prop-types';
import Board from '@/modules/core/client/components/Board.js';
import ManifestoText from './ManifestoText.component.js';

export default function Foundation({ user }) {
  const { t } = useTranslation('pages');

  return (
    <>
      <Board names="nordiclights">
        <div className="container">
          <div className="row">
            <div className="col-xs-12 text-center">
              <br />
              <br />
              <i className="icon-3x icon-heart-o"></i>
              <br />
              <br />
              <h2>{t('Trustroots Foundation')}</h2>
            </div>
          </div>
        </div>
      </Board>

      <section className="container container-spacer">
        <div className="row">
          <div className="col-xs-12 col-sm-offset-1 col-sm-10 col-md-offset-2 col-md-8">
            <p className="lead">
              {t(`Trustroots is owned and operated by Trustroots Foundation, a non-profit
              Limited by Guarantee (LBG) under section 60 exemption, registered in the
              United Kingdom in March 2015.`)}
            </p>

            <ul className="list-inline">
              <li>
                <a href="https://beta.companieshouse.gov.uk/company/09489825">
                  {t('Details')}
                </a>
              </li>
              <li>
                <a href="https://ideas.trustroots.org/wordpress/wp-content/uploads/2015/03/Trustroots-Articles-2015.pdf">
                  {t('Foundation’s Articles')}
                </a>{' '}
                <small className="text-muted">(pdf)</small>
              </li>
              <li>
                <a href="/faq/foundation">{t('FAQ')}</a>
              </li>
              <li>
                <a href="https://ideas.trustroots.org/2015/03/10/announcing-trustroots-foundation/">
                  {t('Announcement')}
                </a>{' '}
                <small className="text-muted">{t('(March, 2015)')}</small>
              </li>
              <li>
                <a href="/support">{t('Contact us')}</a>
              </li>
              <li>
                <a href="/volunteering">{t('Volunteering')}</a>
              </li>
            </ul>
          </div>
        </div>
        {/* /.row */}
      </section>
      {/* /.container */}

      {/* Board */}
      <section className="container container-spacer">
        <hr />

        <div className="row">
          <div className="col-xs-12 col-sm-8 col-sm-offset-2 col-md-6 col-md-offset-3 text-center">
            <h2 id="board">{t('Board')}</h2>
            <p>
              <Trans t={t} ns="pages">
                We are a group of hospitality exchange enthusiasts with
                backgrounds in some notable projects. The same people who also
                brought you <a href="https://hitchwiki.org/">Hitchwiki</a>,{' '}
                <a href="https://trashwiki.org/">Trashwiki</a>,{' '}
                <a href="https://nomadwihki.org/">Nomadwiki</a> &amp; more.
              </Trans>
            </p>
            <p>
              {t(
                'All current board members are also members of the founding team. We will have non-founding members in the board at some point.',
              )}
            </p>
            <br />
            <br />
          </div>
        </div>
        <div className="row">
          <div className="col-xs-12 col-sm-4">
            {/* Mikael */}
            <div className="media">
              <a className="pull-left" href="https://mikaelkorpela.fi/">
                <img
                  className="media-object img-circle"
                  src="//gravatar.com/avatar/d0229f23745d3c266f81c6b0cd014a38?s=200"
                  width="100"
                  alt="Mikael"
                />
              </a>
              <div className="media-body">
                <h4 className="media-heading">Mikael</h4>
                <p className="text-color-links">
                  <Trans t={t} ns="pages">
                    Working on big freegan/travel projects such as{' '}
                    <a href="https://hitchwiki.org/">Hitchwiki</a>,{' '}
                    <a href="http://hitchgathering.org/">
                      Hitchgathering festival
                    </a>
                    , <a href="https://trashwiki.org/">Trashwiki</a> and{' '}
                    <a href="https://nomadwiki.org/">Nomadwiki</a> since 2008.
                    In the past has volunteered for BeWelcome (2013). Active
                    open source contributor and visionary free/gift-economics
                    activist. A developer at{' '}
                    <a href="https://automattic.com/">Automattic</a>.
                  </Trans>
                </p>
                <p>
                  <ul className="list-inline">
                    <li>
                      <a href="https://www.mikaelkorpela.fi/">
                        mikaelkorpela.fi
                      </a>
                    </li>
                    <li>
                      <a href="/profile/mikael">Trustroots profile</a>
                    </li>
                  </ul>
                </p>
              </div>
            </div>
            <br />
            <br />
          </div>
          <div className="col-xs-12 col-sm-4">
            {/* Natalia */}
            <div className="media">
              <img
                className="media-object img-circle pull-left"
                src="/img/team-natalia.jpg"
                width="100"
                alt="Natalia"
              />
              <div className="media-body">
                <h4 className="media-heading">Natalia</h4>
                <p className="text-color-links">
                  {t(
                    'Coming from a multinational business background, Natalia is an enthusiastic of the share and gift economy. Veteran globetrotter and volunteer for different NGOs from hospex as Couchsurfing to nonprofit lobbying orgs.',
                  )}
                </p>
                <p>
                  <ul className="list-inline">
                    <li>
                      <a href="https://www.linkedin.com/in/natalia-s%C3%A1enz-alban%C3%A9s-38469227/">
                        LinkedIn
                      </a>
                    </li>
                    <li>
                      <a href="/profile/natalia_sevilla">Trustroots profile</a>
                    </li>
                  </ul>
                </p>
              </div>
            </div>
          </div>
          <div className="col-xs-12 col-sm-4">
            {/* Kasper */}
            <div className="media">
              <a className="pull-left" href="https://guaka.org/">
                <img
                  className="media-object img-circle"
                  src="/img/team-kasper.png"
                  width="100"
                  alt="Kasper"
                />
              </a>
              <div className="media-body">
                <h4 className="media-heading">Kasper</h4>
                <p className="text-color-links">
                  <Trans t={t} ns="pages">
                    Founded multiple popular and trusted websites such as{' '}
                    <a href="https://hitchwiki.org/">Hitchwiki</a>,{' '}
                    <a href="https://trashwiki.org/">Trashwiki</a>,{' '}
                    <a href="https://nomadwiki.org/">Nomadwiki</a>,{' '}
                    <a href="https://couchwiki.org/">Couchwiki</a> and{' '}
                    <a href="https://deletionpedia.org/">Deletionpedia</a>.{' '}
                    Volunteered for CouchSurfing as a tech team coordinator in
                    2006 and 2007 and for{' '}
                    <a href="https://www.bewelcome.org/">BeWelcome</a> since
                    2007. Loves paradoxes, makes money with{' '}
                    <a href="https://moneyless.org/">moneyless.org</a>.
                  </Trans>
                </p>
                <p>
                  <ul className="list-inline">
                    <li>
                      <a href="https://guaka.org/">guaka.org</a>
                    </li>
                    <li>
                      <a href="/profile/guaka">Trustroots profile</a>
                    </li>
                  </ul>
                </p>
              </div>
            </div>
          </div>
        </div>

        <hr />

        <div className="row">
          <div className="col-xs-12 col-sm-8 col-sm-offset-2 col-md-6 col-md-offset-3 text-center">
            <h2>{t('Past board members')}</h2>
            <p>{t('Callum and Carlos were also part of the founding team.')}</p>
            <br />
            <br />
          </div>
        </div>

        <div className="row">
          <div className="col-xs-12 col-sm-4 col-sm-offset-2">
            {/* Callum */}
            <div className="media">
              <a className="pull-left" href="https://www.callum-macdonald.com/">
                <img
                  className="media-object img-circle"
                  src="//gravatar.com/avatar/1e2eebc68bae7e891391688ad1c331d1?s=100"
                  width="100"
                  alt=""
                />
              </a>
              <div className="media-body">
                <h4 className="media-heading">Callum</h4>
                <p className="text-color-links">
                  {t(
                    'Long term nomad and technology expert. Volunteered for BeWelcome BoD in 2013 and for CouchSurfing in 2007.',
                  )}
                </p>
                <p>
                  <ul className="list-inline">
                    <li>
                      <a href="https://www.callum-macdonald.com/">
                        callum-macdonald.com
                      </a>
                    </li>
                    <li>
                      <a href="/profile/chmac">Trustroots profile</a>
                    </li>
                  </ul>
                </p>
              </div>
            </div>
          </div>
          <div className="col-xs-12 col-sm-4">
            {/* Carlos */}
            <div className="media">
              <img
                className="media-object img-circle pull-left"
                src="/img/team-carlos.jpg"
                width="100"
                alt="Carlos"
              />
              <div className="media-body">
                <h4 className="media-heading">Carlos</h4>
                <p className="text-color-links">
                  {t(
                    'Love to travel, passionate and enthusiastic about share economy and hospitality exchange as human development tools. Volunteered CouchSurfing from 2008 to 2010 as well as other NGOs.',
                  )}
                </p>
                <p>
                  <ul className="list-inline">
                    <li>
                      <a href="https://www.linkedin.com/in/carlosmcardenas/">
                        LinkedIn
                      </a>
                    </li>
                    <li>
                      <a href="/profile/carlos">Trustroots profile</a>
                    </li>
                  </ul>
                </p>
              </div>
            </div>
          </div>
        </div>

        <hr />
      </section>

      <section className="vision-footer">
        <div className="container">
          <div className="row" id="mission-vision-values">
            <div className="col-xs-12 text-center hidden-xs">
              <h2>{t('Vision, Mission & Values')}</h2>
              <br />
              <br />
            </div>

            <div className="col-sm-4 text-center">
              <h3 id="vision">{t('Vision')}</h3>
              <p className="lead">
                <em>“{t('A world that encourages trust and adventure.')}”</em>
              </p>
            </div>
            <div className="col-sm-4 text-center">
              <h3 id="mission">{t('Mission')}</h3>
              <p className="lead">
                {t(`Trustroots seeks to be a platform for sharing and getting people
                together. We aim to connect likeminded people together. We encourage
                trust, adventure and intercultural connections.`)}
              </p>
            </div>
            <div className="col-sm-4 text-center">
              <h3 id="values">{t('Values')}</h3>
              <ul className="list-unstyled lead">
                <li>{t('Trust')}</li>
                <li>{t('Adventure')}</li>
                <li>{t('Transparency')}</li>
                <li>{t('Freedom')}</li>
              </ul>
            </div>
          </div>
          {/* /.row */}
        </div>
        {/* /.container */}
      </section>

      {/* Manifesto */}
      <Board
        className="board-primary board-inset"
        names="jungleroad"
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
                    href="/signup"
                    className="btn btn-lg btn-action btn-inverse"
                  >
                    {t('Join Trustroots')}
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
      </Board>
    </>
  );
}

Foundation.propTypes = {
  user: userType,
};
