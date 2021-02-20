// External dependencies
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import Experience from './Experience';
import { experienceType } from '@/modules/experiences/client/experiences.prop-types';

/**
 * List of user's experiences
 */
export default function ExperiencesSection({ experiences, onReceiverProfile }) {
  return experiences.map(experience => (
    <div className="row" key={experience._id}>
      <div className="col-xs-12">
        <Experience
          experience={experience}
          onReceiverProfile={onReceiverProfile}
        />
      </div>
    </div>
  ));
}

ExperiencesSection.propTypes = {
  experiences: PropTypes.arrayOf(experienceType).isRequired,
  onReceiverProfile: PropTypes.bool.isRequired,
};
