import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

const Labels = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: 10px 0;
  .label {
    margin: 0 5px 5px 0;
  }
`;

export default function Meta({ met, hostedMe, hostedThem, recommend }) {
  const { t } = useTranslation('references');

  return (
    <Labels>
      {[
        recommend === 'yes' && t('Recommend'),
        recommend === 'no' && t('Not recommend'),
        hostedMe && t('Guest'),
        hostedThem && t('Host'),
        met && t('Met in person'),
      ]
        .filter(label => !!label)
        .map(label => (
          <span key={label} className="label label-default">
            {label}
          </span>
        ))}
    </Labels>
  );
}

Meta.propTypes = {
  hostedMe: PropTypes.bool.isRequired,
  hostedThem: PropTypes.bool.isRequired,
  met: PropTypes.bool.isRequired,
  recommend: PropTypes.string.isRequired,
};
