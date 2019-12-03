import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import Board from '../../../core/client/components/Board';

export default function TribesHeader({ isLogged, onBoardChanged }) {

  const { t } = useTranslation('tribes');

  return <Board name="tribes-1" onNameChanged={onBoardChanged}>
    <section className="board tribes-header" tr-boards="'tribes-1'">
      <div className="container">
        <div className="row">
          <div className="col-xs-12 text-center">
            <br /><br />
            <h2>{t('Discover Tribes')}</h2>
            <br />
            <p className="lead">
              {t('Joining Tribes helps you find likeminded Trustroots members.')}
            </p>
            {!isLogged && <div>
              <hr className="hr-white hr-xs"/>
              <a href="/signup" className="btn btn-action btn-default">
                {t('Sign up with Trustroots')}
              </a>
            </div>}
          </div>
        </div>
      </div>
    </section>
  </Board>;
}

TribesHeader.propTypes = {
  isLogged: PropTypes.bool.isRequired,
  onBoardChanged: PropTypes.func.isRequired
};
