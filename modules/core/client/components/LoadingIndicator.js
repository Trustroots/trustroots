// External dependencies
import { withTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import '@/config/client/i18n';

function LoadingIndicator({ t }) {
  return (
    <div
      aria-busy="true"
      aria-live="assertive"
      className="content-wait"
      role="alertdialog"
    >
      <small>{t('Wait a moment…')}</small>
    </div>
  );
}

LoadingIndicator.propTypes = {
  t: PropTypes.func.isRequired
};

export default withTranslation('core')(LoadingIndicator);
