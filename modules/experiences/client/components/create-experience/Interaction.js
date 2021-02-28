import React from 'react';
import PropTypes from 'prop-types';
import '@/config/client/i18n';
import { useTranslation } from 'react-i18next';

/**
 * Presentational component for picking an interaction
 */
export default function Interaction({ interactions, onChange }) {
  const { t } = useTranslation('experiences');

  return (
    <div className="panel panel-default">
      <div className="panel-heading">
        <h4 id="how-do-you-know-them-question">{t('How do you know them?')}</h4>
      </div>
      <div className="panel-body">
        <div role="group" aria-labelledby="how-do-you-know-them-question">
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
                checked={interactions.host}
                onChange={() => onChange('host')}
              />
              {t('I hosted them')}
            </label>
          </div>
          <div className="checkbox">
            <label>
              <input
                type="checkbox"
                checked={interactions.guest}
                onChange={() => onChange('guest')}
              />
              {t('They hosted me')}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

Interaction.propTypes = {
  onChange: PropTypes.func.isRequired,
  interactions: PropTypes.object.isRequired,
};
