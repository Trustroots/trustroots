import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';

export default function Recommendation({
  met,
  hostedMe,
  hostedThem,
  recommend,
  isExperienceWrittenByUser,
}) {
  const { t } = useTranslation('references');

  return (
    <div>
      {isExperienceWrittenByUser && (
        <ul className="list-inline">
          {hostedMe && <li>{t('Guest.')}</li>}
          {hostedThem && <li>{t('Host.')}</li>}
          {met && <li>{t('Met in person.')}</li>}
        </ul>
      )}
      <p>
        {recommend === 'yes' && t('Recommend.')}
        {recommend === 'no' && t('Not recommend.')}
      </p>
    </div>
  );
}

Recommendation.propTypes = {
  met: PropTypes.bool.isRequired,
  hostedMe: PropTypes.bool.isRequired,
  hostedThem: PropTypes.bool.isRequired,
  recommend: PropTypes.string.isRequired,
  isExperienceWrittenByUser: PropTypes.bool.isRequired,
};
