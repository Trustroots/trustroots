// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';

// Internal dependencies
import { read as readReferences } from '../api/references.api';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import ReferenceCounts from './read-references/ReferenceCounts';
import ReferencesSection from './read-references/ReferencesSection';

/**
 * List of user's references
 */
export default function ListReferences({ profile, authenticatedUser }) {
  const { t } = useTranslation('references');
  const [publicExperiences, setPublicExperiences] = useState([]);
  const [pendingExperiences, setPendingExperiences] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchReferences() {
    setIsLoading(true);
    try {
      const experiences = await readReferences({
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

  // Load references from api
  useEffect(() => {
    fetchReferences();
  }, [profile]);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  const hasPublicReferences = publicExperiences.length > 0;
  const hasPendingReferences = pendingExperiences.length > 0;

  // No references
  if (!hasPendingReferences && !hasPublicReferences) {
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
      {hasPublicReferences && (
        <ReferenceCounts publicReferences={publicExperiences} />
      )}
      {hasPendingReferences && (
        <ReferencesSection
          title={t('Experiences pending publishing')}
          experiences={pendingExperiences}
        />
      )}
      {hasPublicReferences && (
        <ReferencesSection
          // Show "Public" title only if there are also pending experiences listed
          title={hasPendingReferences && t('Public experiences')}
          experiences={publicExperiences}
        />
      )}
    </>
  );
}

ListReferences.propTypes = {
  profile: PropTypes.object.isRequired,
  authenticatedUser: PropTypes.object.isRequired,
};
