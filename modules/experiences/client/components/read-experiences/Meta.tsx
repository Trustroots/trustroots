import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

import { interactionsType } from '@/modules/experiences/client/experiences.prop-types';
import type {
  ExperienceInteractions,
  ExperienceRecommendation,
} from '../../experiences.prop-types';

const Labels = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: 10px 0;
  .label {
    margin: 0 5px 5px 0;
  }
`;

export default function Meta({
  interactions,
  recommend,
}: {
  interactions?: ExperienceInteractions;
  recommend?: ExperienceRecommendation;
}) {
  const { t } = useTranslation('experiences') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  return (
    <Labels>
      {[
        recommend === 'yes' && t('Recommend'),
        recommend === 'no' && t('Not recommend'),
        interactions?.guest && t('Guest'),
        interactions?.host && t('Host'),
        interactions?.met && t('Met in person'),
      ]
        .filter((label): label is string => typeof label === 'string')
        .map(label => (
          <span key={label} className="label label-default">
            {label}
          </span>
        ))}
    </Labels>
  );
}

Meta.propTypes = {
  interactions: interactionsType.isRequired,
  recommend: PropTypes.string.isRequired,
};
