import React from 'react';
import ManifestoText from './ManifestoText.component.js';
import { useTranslation } from 'react-i18next';
import '@/config/client/i18n';
import Board from '@/modules/core/client/components/Board.js';

export default function Foundation() {
  const { t } = useTranslation('pages');

  // mock data for testing
  const app = {
    user: true,
  };

  return (
    <>
      <Board className="board" names="'nordiclights'">
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
                </a>
                <small className="text-muted">(pdf)</small>
              </li>
              <li>
                <a href="/team">{t('Board')}</a>
              </li>
              <li>
                <a href="/foundation">{t('FAQ')}</a>
              </li>
              <li>
                <a href="https://ideas.trustroots.org/2015/03/10/announcing-trustroots-foundation/">
                  {t('Announcement')}
                </a>
                <small className="text-muted">{t('(March, 2015)')}</small>
              </li>
              <li>
                <a href="/donate">{t('Donate')}</a>
              </li>
              <li>
                <a href="/support">{t('Contact us')}</a>
              </li>
              <li>
                <a href="/volunteering">{t('Volunteering')}</a>
              </li>
            </ul>
            <br />
            <br />
          </div>
        </div>
        {/* /.row */}
      </section>
      {/* /.container */}

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
        className="board board-primary board-inset"
        names="'jungleroad'"
        id="manifesto"
      >
        <div className="container">
          <div className="row">
            <div className="col-md-offset-3 col-md-6 text-center lead font-brand-light">
              <ManifestoText></ManifestoText>
              {!app.user && (
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

Foundation.propTypes = {};
