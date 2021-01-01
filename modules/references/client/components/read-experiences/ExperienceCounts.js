import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';
import { experienceType } from '@/modules/references/client/experiences.prop-types';

const Counts = styled.div`
  display: flex;
  justify-content: space-between;
`;

export default function ExperienceCounts({ publicExperiences }) {
  const { t } = useTranslation('references');

  const positiveCount = publicExperiences.filter(
    ({ recommend }) => recommend === 'yes',
  ).length;
  const unknownCount = publicExperiences.filter(
    ({ recommend }) => recommend === 'unknown',
  ).length;
  const negativeCount = publicExperiences.filter(
    ({ recommend }) => recommend === 'no',
  ).length;

  return (
    <div className="panel panel-default">
      <Counts className="panel-body references-summary">
        <span>{t('{{count}} recommend', { count: positiveCount })}</span>
        <span>{t('{{count}} unknown', { count: unknownCount })}</span>
        <span>{t('{{count}} not recommend', { count: negativeCount })}</span>
      </Counts>
    </div>
  );
}

ExperienceCounts.propTypes = {
  publicExperiences: PropTypes.arrayOf(experienceType).isRequired,
};
