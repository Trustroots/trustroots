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
        <div className="tw:page-container">
          <div className="tw:grid-row">
            <div className="tw:grid-col-12 text-center">
              <br />
              <br />
              <h2>{t('Rules')}</h2>
            </div>
          </div>
        </div>
      </Board>

      <section className="tw:page-container container-spacer">
        <div className="tw:grid-row">
          <div className="tw:grid-col-12 tw:sm:grid-offset-1 tw:sm:grid-col-10 tw:md:grid-offset-2 tw:md:grid-col-8">
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
