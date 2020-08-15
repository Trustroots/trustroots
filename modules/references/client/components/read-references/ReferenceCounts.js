import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

const Counts = styled.div`
  display: flex;
  align-content: space-between;
`;

export default function ReferenceCounts({ publicReferences }) {
  const { t } = useTranslation('references');

  const positiveCount = publicReferences.filter(
    ({ recommend }) => recommend === 'yes',
  ).length;
  const unknownCount = publicReferences.filter(
    ({ recommend }) => recommend === 'unknown',
  ).length;
  const negativeCount = publicReferences.filter(
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

ReferenceCounts.propTypes = {
  publicReferences: PropTypes.array.isRequired,
};
