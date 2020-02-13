import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import Board from '@/modules/core/client/components/Board';

export default function TribesHeader({
  isLoggedIn,
  onDisplayPhoto,
  onHidePhoto,
}) {
  const { t } = useTranslation('tribes');

  return (
    <Board
      names="tribes-1"
      className="tribes-header"
      onDisplayPhoto={onDisplayPhoto}
      onHidePhoto={onHidePhoto}
    >
      <div className="container">
        <div className="row">
          <div className="col-xs-12 text-center">
            <br />
            <br />
            <h2>{t('Discover Tribes')}</h2>
            <br />
            <p className="lead">
              {t(
                'Joining Tribes helps you find likeminded Trustroots members.',
              )}
            </p>
            {!isLoggedIn && (
              <div>
                <hr className="hr-white hr-xs" />
                <a href="/signup" className="btn btn-action btn-default">
                  {t('Sign up with Trustroots')}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </Board>
  );
}

TribesHeader.propTypes = {
  isLoggedIn: PropTypes.bool.isRequired,
  onDisplayPhoto: PropTypes.func,
  onHidePhoto: PropTypes.func,
};
