// External dependencies
import { Trans, useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import '@/config/client/i18n';
import Board from '@/modules/core/client/components/Board.js';
import SupportForm from './SupportForm';

export default function SupportPage({ user }) {
  const { t } = useTranslation('support');

  return (
    <>
      <Board names="forestpath">
        <div className="container">
          <div className="row">
            <div className="col-xs-12 text-center">
              <br />
              <br />
              <h2>{t('Trustroots Support')}</h2>
            </div>
          </div>
        </div>
      </Board>

      <section className="container container-spacer">
        <div className="row">
          <div className="col-xs-12 col-md-8 col-lg-7">
            <SupportForm user={user} />
          </div>
          <div className="col-xs-12 col-md-4 col-lg-5">
            <h3>{t('See also')}</h3>
            <ul className="list-unstyled lead">
              <li>
                <a href="/faq">{t('Frequently Asked Questions')}</a>
              </li>
              {user && (
                <li>
                  <a href="/profile/edit/account#remove">
                    {t('Removing your account')}
                  </a>
                </li>
              )}
              <li>
                <Trans t={t} ns="support">
                  <a href="/volunteering">Become a volunteer</a> and make a
                  difference!
                </Trans>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}

SupportPage.propTypes = {
  user: PropTypes.object,
};
