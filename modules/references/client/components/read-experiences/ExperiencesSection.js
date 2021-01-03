// External dependencies
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import Experience from './Experience';
import { experienceType } from '@/modules/references/client/experiences.prop-types';

/**
 * List of user's experiences
 */
export default function ExperiencesSection({ title, experiences }) {
  return (
    <section>
      {title && (
        <div className="row">
          <div className="col-xs-12 col-sm-6">
            <h4 className="text-muted">{title}</h4>
          </div>
        </div>
      )}
      {experiences.map(experience => (
        <div className="row" key={experience._id}>
          <div className="col-xs-12">
            <Experience experience={experience} />
          </div>
        </div>
      ))}
    </section>
  );
}

ExperiencesSection.propTypes = {
  experiences: PropTypes.arrayOf(experienceType).isRequired,
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
};
