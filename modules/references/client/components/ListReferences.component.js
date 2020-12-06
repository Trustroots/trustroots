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
  const [publicExperiencePairs, setPublicExperiencePairs] = useState([]);
  const [pendingExperiences, setPendingExperiences] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchReferences() {
    setIsLoading(true);
    try {
      const experiences = await readReferences({
        userTo: profile._id,
        includeReplies: true,
      });

      const publicExperiences = experiences.filter(
        experience => experience.public,
      );
      const pendingNewestFirst = experiences.filter(
        experience => !experience.public,
      );

      /* TODO: compare by ids (couldn't make it work, so I used usernames to compare for now) */
      const publicExperiencePairsDict = publicExperiences
        .filter(experience => experience.userTo.username === profile.username)
        .reduce(
          (a, exp) => ({
            ...a,
            [exp.userFrom.username]: { sharedWithUser: exp },
          }),
          {},
        );

      publicExperiences.forEach(experience => {
        if (experience.userFrom.username === profile.username) {
          const userTo = experience.userTo.username;
          if (publicExperiencePairsDict[userTo] === undefined) {
            publicExperiencePairsDict[userTo] = {};
          }
          publicExperiencePairsDict[userTo].writtenByUser = experience;
        }
      });

      // Object.values(publicExperiencePairs).forEach(pair => {
      //   if (pair.writtenByUser === undefined) {
      //     throw Error(`The following experience is public: ${pair.sharedWithUser._id}.
      //     The reply to it should also exist but it doesn't.`);
      //   }
      //   if (pair.sharedWithUser.userTo.username !== pair.writtenByUser.userFrom.username) {
      //     throw Error(
      //       `This experience ${pair.writtenByUser._id} should be reply to this one ${pair.sharedWithUser._id} but it is not`,
      //     );
      //   }
      // });

      const pendingOldestFirst = [...pendingNewestFirst].reverse();

      setPublicExperiencePairs(Object.values(publicExperiencePairsDict));
      setPendingExperiences(
        pendingOldestFirst.map(experience => {
          return { sharedWithUser: experience };
        }),
      );
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

  const hasPublicReferences = publicExperiencePairs.length > 0;
  const hasPendingReferences = pendingExperiences.length > 0;

  // No references
  if (!hasPendingReferences && !hasPublicReferences) {
    return (
      <div className="row content-empty">
        <i className="icon-3x icon-users"></i>
        <h4>{t('No references yet.')}</h4>
        {authenticatedUser._id !== profile._id && (
          <a href={`/profile/${profile.username}/references/new`}>
            {t('Write one!')}
          </a>
        )}
      </div>
    );
  }

  return (
    <>
      {hasPublicReferences && (
        <ReferenceCounts publicReferences={publicExperiencePairs} />
      )}
      {hasPendingReferences && (
        <ReferencesSection
          title={t('Experiences pending publishing')}
          referencePairs={pendingExperiences}
        />
      )}
      {hasPublicReferences && (
        <ReferencesSection
          // Show "Public" title only if there are also pending experiences listed
          title={hasPendingReferences && t('Public experiences')}
          referencePairs={publicExperiencePairs}
        />
      )}
    </>
  );
}

ListReferences.propTypes = {
  profile: PropTypes.object.isRequired,
  authenticatedUser: PropTypes.object.isRequired,
};
