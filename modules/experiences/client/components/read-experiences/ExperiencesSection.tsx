import React from 'react';

// Internal dependencies
import Experience from './Experience';
import type { Experience as ExperienceModel } from '../../../shared/experience';

/**
 * List of user's experiences
 */
export default function ExperiencesSection({
  experiences,
  onReceiverProfile,
}: {
  experiences: ExperienceModel[];
  onReceiverProfile: boolean;
}) {
  return experiences.map(experience => (
    <div className="tw:grid-row" key={experience._id}>
      <div className="tw:grid-col-12">
        <Experience
          experience={experience}
          onReceiverProfile={onReceiverProfile}
        />
      </div>
    </div>
  ));
}
