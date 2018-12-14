import React from 'react';
import PropTypes from 'prop-types';
import '@/config/lib/i18n';
import { withNamespaces } from 'react-i18next';

/**
 * Presentational component for picking an interaction
 */
const Interaction = withNamespaces('reference')(function ({ t, interactions, onChange }) {
  return (
    <div className="panel panel-default">
      <div className="panel-heading">
        <h4 id="howDoYouKnowThemQuestion">{t('How do you know them?')}</h4>
      </div>
      <div className="panel-body">
        <div role="group" aria-labelledby="howDoYouKnowThemQuestion">
          <div className="checkbox">
            <label>
              <input
                type="checkbox"
                checked={interactions.met}
                onChange={() => onChange('met')}
              />
              {t('Met in person')}
            </label>
          </div>
          <div className="checkbox">
            <label>
              <input
                type="checkbox"
                checked={interactions.hostedThem}
                onChange={() => onChange('hostedThem')}
              />
              {t('I hosted them')}
            </label>
          </div>
          <div className="checkbox">
            <label>
              <input
                type="checkbox"
                checked={interactions.hostedMe}
                onChange={() => onChange('hostedMe')}
              />
              {t('They hosted me')}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
});

Interaction.propTypes = {
  onChange: PropTypes.func.isRequired,
  interactions: PropTypes.object.isRequired
};

export default Interaction;
