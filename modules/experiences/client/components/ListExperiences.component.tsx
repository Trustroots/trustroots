// External dependencies
import { useTranslation } from 'react-i18next';
import { Button } from '@trustroots/ui/Button';
import React, { useState, useEffect } from 'react';

// Internal dependencies
import { read as readExperiences } from '../api/experiences.api';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import ExperienceCounts from './read-experiences/ExperienceCounts';
import ExperiencesSection from './read-experiences/ExperiencesSection';
import PublicExperiencesList from './read-experiences/PublicExperiencesList';
import NoContent from '@/modules/core/client/components/NoContent';
import type { Experience, ExperienceUser } from '../../shared/experience';

const NoContentWithChildren = NoContent as unknown as React.ComponentType<{
  icon: string;
  message: string;
  children?: React.ReactNode;
}>;

export type ExperienceAction = { href: string; label: string };

/**
 * List of user's experiences
 */
export default function ListExperiences({
  profile,
  authenticatedUser,
  experienceAction,
}: {
  profile: ExperienceUser;
  authenticatedUser: ExperienceUser;
  experienceAction?: ExperienceAction;
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
        message={
          onReceiverProfile
            ? t('No experiences received yet.')
            : t('No experiences yet.')
        }
      >
        {!onReceiverProfile && experienceAction && (
          <p>
            <br />
            <Button
              intent="primary"
              render={<a href={experienceAction.href} />}
            >
              {experienceAction.label}
            </Button>
          </p>
        )}
      </NoContentWithChildren>
    );
  }

  const needsReply = (experience: Experience) =>
    onReceiverProfile && !experience.response;
  const pendingAwaitingReply = pendingExperiences.filter(needsReply);
  const otherPending = pendingExperiences.filter(
    experience => !needsReply(experience),
  );

  return (
    <>
      {hasPublicExperiences && (
        <ExperienceCounts experiences={publicExperiences} />
      )}
      <PublicExperiencesList key={profile._id} experiences={publicExperiences}>
        {(filtered, tagFilters) => {
          const awaitingReply = [
            ...pendingAwaitingReply,
            ...filtered.filter(needsReply),
          ];
          const otherPublic = filtered.filter(
            experience => !needsReply(experience),
          );

          return (
            <>
              {awaitingReply.length > 0 && (
                <section aria-labelledby="experiences-awaiting-reply-heading">
                  <h3 id="experiences-awaiting-reply-heading">
                    {t('Experiences awaiting your reply')}
                  </h3>
                  <ExperiencesSection
                    experiences={awaitingReply}
                    onReceiverProfile
                    tagFilters={tagFilters}
                  />
                </section>
              )}
              {otherPending.length > 0 && (
                <>
                  <div className="tw:grid-row">
                    <div className="tw:grid-col-12 tw:sm:grid-col-6">
                      <h4 className="text-muted">
                        {t('Experiences pending publishing') as string}
                      </h4>
                    </div>
                  </div>
                  <ExperiencesSection
                    experiences={otherPending}
                    onReceiverProfile={onReceiverProfile}
                  />
                </>
              )}
              <ExperiencesSection
                experiences={otherPublic}
                onReceiverProfile={onReceiverProfile}
                tagFilters={tagFilters}
              />
            </>
          );
        }}
      </PublicExperiencesList>
    </>
  );
}
