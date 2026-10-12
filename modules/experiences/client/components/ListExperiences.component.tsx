// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';

// Internal dependencies
import { read as readExperiences } from '../api/experiences.api';
import { getProfileExperiencesPath } from '@/modules/core/shared/navigation-links';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import ExperienceCounts from './read-experiences/ExperienceCounts';
import ExperiencesSection from './read-experiences/ExperiencesSection';
import NoContent from '@/modules/core/client/components/NoContent';
import type { Experience, ExperienceUser } from '../experiences.prop-types';

const NoContentWithChildren = NoContent as unknown as React.ComponentType<{
  icon: string;
  message: string;
  children?: React.ReactNode;
}>;

/**
 * List of user's experiences
 */
export default function ListExperiences({
  profile,
  authenticatedUser,
}: {
  profile: ExperienceUser;
  authenticatedUser: ExperienceUser;
}) {
  const { t } = useTranslation('experiences') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const [publicExperiences, setPublicExperiences] = useState<Experience[]>([]);
  const [pendingExperiences, setPendingExperiences] = useState<Experience[]>(
    [],
  );
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

  const onReceiverProfile = authenticatedUser._id === profile._id;

  // No experiences
  if (!hasPendingExperiences && !hasPublicExperiences) {
    return (
      <NoContentWithChildren
        icon="users"
        message={t('No experiences yet.') as string}
      >
        {!onReceiverProfile && (
          <p>
            <br />
            <a
              className="btn btn-primary"
              href={getProfileExperiencesPath(profile.username)}
            >
              {t('Share your experience') as string}
            </a>
          </p>
        )}
      </NoContentWithChildren>
    );
  }

  return (
    <>
      {hasPendingExperiences && (
        <>
          <div className="row">
            <div className="col-xs-12 col-sm-6">
              <h4 className="text-muted">
                {t('Experiences pending publishing') as string}
              </h4>
            </div>
          </div>
          <ExperiencesSection
            experiences={pendingExperiences}
            onReceiverProfile={onReceiverProfile}
          />
        </>
      )}
      {hasPublicExperiences && (
        <>
          <ExperienceCounts experiences={publicExperiences} />
          <ExperiencesSection
            experiences={publicExperiences}
            onReceiverProfile={onReceiverProfile}
          />
        </>
      )}
    </>
  );
}

ListExperiences.propTypes = {
  profile: PropTypes.object.isRequired,
  authenticatedUser: PropTypes.object.isRequired,
};
