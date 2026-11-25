import React from 'react';

// Internal dependencies
import Experience from './Experience';
import type { ExperienceTagFilters } from './Meta';
import type { Experience as ExperienceModel } from '../../../shared/experience';

/**
 * List of user's experiences
 */
export default function ExperiencesSection({
  experiences,
  onReceiverProfile,
  tagFilters,
}: {
  experiences: ExperienceModel[];
  onReceiverProfile: boolean;
  tagFilters?: ExperienceTagFilters;
}) {
  return experiences.map(experience => (
    <div className="tw:grid-row" key={experience._id}>
      <div className="tw:grid-col-12">
        <Experience
          experience={experience}
          onReceiverProfile={onReceiverProfile}
          tagFilters={experience.public ? tagFilters : undefined}
        />
      </div>
    </div>
  ));
}
