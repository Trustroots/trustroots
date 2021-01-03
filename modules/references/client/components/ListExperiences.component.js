// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';

// Internal dependencies
import { read as readExperiences } from '../api/references.api';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import ExperienceCounts from './read-experiences/ExperienceCounts';
import ExperiencesSection from './read-experiences/ExperiencesSection';

/**
 * List of user's experiences
 */
export default function ListExperiences({ profile, authenticatedUser }) {
  const { t } = useTranslation('references');
  const [publicExperiences, setPublicExperiences] = useState([]);
  const [pendingExperiences, setPendingExperiences] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchExperiences() {
    setIsLoading(true);
    try {
      const experiences = await readExperiences({
        userTo: profile._id,
      });

      const publicExperiences = experiences.filter(
        experience => experience.public,
      );
      setPublicExperiences(publicExperiences);

      const pendingNewestFirst = experiences.filter(
        experience => !experience.public,
      );

      const pendingOldestFirst = [...pendingNewestFirst].reverse();
      setPendingExperiences(pendingOldestFirst);
    } finally {
      setIsLoading(false);
    }
  }

  // Load experiences from api
  useEffect(() => {
    fetchExperiences();
  }, [profile]);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  const hasPublicExperiences = publicExperiences.length > 0;
  const hasPendingExperiences = pendingExperiences.length > 0;

  // No experiences
  if (!hasPendingExperiences && !hasPublicExperiences) {
    return (
      <div className="row content-empty">
        <i className="icon-3x icon-users"></i>
        <h4>{t('No references yet.')}</h4>
        {authenticatedUser._id !== profile._id && (
          <a href={`/profile/${profile.username}/experiences/new`}>
            {t('Write one!')}
          </a>
        )}
      </div>
    );
  }

  return (
    <>
      {hasPublicExperiences && (
        <ExperienceCounts publicExperiences={publicExperiences} />
      )}
      {hasPendingExperiences && (
        <ExperiencesSection
          title={t('Experiences pending publishing')}
          experiences={pendingExperiences}
        />
      )}
      {hasPublicExperiences && (
        <ExperiencesSection
          // Show "Public" title only if there are also pending experiences listed
          title={hasPendingExperiences && t('Public experiences')}
          experiences={publicExperiences}
        />
      )}
    </>
  );
}

ListExperiences.propTypes = {
  profile: PropTypes.object.isRequired,
  authenticatedUser: PropTypes.object.isRequired,
};
