import React from 'react';
import Board from '@/modules/core/client/components/Board.js';
import { Trans, useTranslation } from 'react-i18next';

export default function DonatePolicy() {
  const { t } = useTranslation('pages');

  return (
    <>
      <Board names="forestpath">
        <div className="container">
          <div className="row">
            <div className="col-xs-12 text-center">
              <br />
              <br />
              <h2>{t('Donor policy')}</h2>
            </div>
          </div>
        </div>
      </Board>

      <section className="container container-spacer">
        <div className="row">
          <div className="col-xs-12 col-sm-8 col-md-9">
            <p className="lead">
              <em>
                <Trans t={t} ns="pages">
                  We&apos;re working on starting accepting donations and writing
                  our policies. If you have expertise on this and would like to
                  help, <a href="/support">drop us a line!</a>
                </Trans>
              </em>
            </p>

            <p>
              <Trans t={t} ns="pages">
                We support the{' '}
                <a href="http://www.afpnet.org/ethics/enforcementDetail.cfm?ItemNumber=3359">
                  Donor Bill of Rights
                </a>
              </Trans>
            </p>

            <p>
              <Trans t={t} ns="pages">
                See also our <a href="privacy">Privacy policy</a>
              </Trans>
            </p>

            <h3>{t('Questions?')}</h3>
            <p>
              <Trans t={t} ns="pages">
                <a href="/support">Contact us</a> if you have any further
                questions!
              </Trans>
            </p>
          </div>

          <div className="col-xs-12 col-sm-4 col-md-3">
            <div className="sidebar">
              <div className="panel panel-default">
                <div className="panel-body">
                  <div className="list-group">
                    <a href="/donate" className="list-group-item">
                      {t('Donate')}
                    </a>
                    <a href="/donate/help" className="list-group-item">
                      {t('Donation help')}
                    </a>
                    <a href="/donate/policy" className="list-group-item active">
                      {t('Donor policy')}
                    </a>
                  </div>
                </div>
              </div>
            </div>
            {/* .sidebar */}
          </div>
        </div>
        {/* /.row */}
      </section>
      {/* /.container */}
    </>
  );
}

DonatePolicy.propTypes = {};
