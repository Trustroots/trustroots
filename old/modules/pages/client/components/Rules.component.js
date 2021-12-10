import React from 'react';
import Board from '@/modules/core/client/components/Board.js';
import RulesText from '@/modules/pages/client/components/RulesText.component.js';
import { Trans, useTranslation } from 'react-i18next';

export default function Rules() {
  const { t } = useTranslation('pages');

  return (
    <>
      <Board names="forestpath">
        <div className="container">
          <div className="row">
            <div className="col-xs-12 text-center">
              <br />
              <br />
              <h2>{t('Rules')}</h2>
            </div>
          </div>
        </div>
      </Board>

      <section className="container container-spacer">
        <div className="row">
          <div className="col-xs-12 col-sm-offset-1 col-sm-10 col-md-offset-2 col-md-8">
            <div>
              <RulesText />
            </div>
            <p>
              <Trans t={t} ns="pages">
                See also our page about <a href="privacy">privacy</a>.
              </Trans>
            </p>
            <p className="lead">
              <em>{t('Thank you!')}</em>
            </p>
          </div>
        </div>
        {/* /.row */}
      </section>
      {/* /.container */}
    </>
  );
}

Rules.propTypes = {};
