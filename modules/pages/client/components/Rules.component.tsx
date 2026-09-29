import type { PageTranslator } from '../types';
import React from 'react';
import Board from './PageBoard';
import RulesText from '@/modules/pages/client/components/RulesText.component';
import { Trans, useTranslation } from 'react-i18next';

export default function Rules() {
  const { t: rawT } = useTranslation('pages');
  const t = rawT as unknown as PageTranslator;

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
              <Trans t={rawT} ns="pages">
                See also our pages about <a href="/safety">safety</a> and{' '}
                <a href="/privacy">privacy</a>.
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
