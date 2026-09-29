import React from 'react';
import PropTypes from 'prop-types';
import '@/config/client/i18n';
import { useTranslation } from 'react-i18next';
import type { ExperienceInteractions } from '../../experiences.prop-types';

type InteractionKind = 'met' | 'host' | 'guest';

interface InteractionProps {
  interactions: ExperienceInteractions;
  onChange: (interaction: InteractionKind) => void;
}

/**
 * Presentational component for picking an interaction
 */
export default function Interaction({
  interactions,
  onChange,
}: InteractionProps) {
  const { t } = useTranslation('experiences') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  return (
    <div className="panel panel-default">
      <div className="panel-heading">
        <h4 id="how-do-you-know-them-question">
          {t('How do you know them?') as string}
        </h4>
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
              {t('Met in person') as string}
            </label>
          </div>
          <div className="checkbox">
            <label>
              <input
                type="checkbox"
                checked={interactions.host}
                onChange={() => onChange('host')}
              />
              {t('I hosted them') as string}
            </label>
          </div>
          <div className="checkbox">
            <label>
              <input
                type="checkbox"
                checked={interactions.guest}
                onChange={() => onChange('guest')}
              />
              {t('They hosted me') as string}
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
