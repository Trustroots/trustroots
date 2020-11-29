// External dependencies
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import Reference from './Reference';

/**
 * List of user's references
 */
export default function ReferencesSection({ title, references }) {
  return (
    <section>
      {title && (
        <div className="row">
          <div className="col-xs-12 col-sm-6">
            <h4 className="text-muted">{title}</h4>
          </div>
        </div>
      )}
      <div className="row">
        <div className="col-xs-12">
          {references.map(reference => (
            <Reference key={reference._id} reference={reference} />
          ))}
        </div>
      </div>
    </section>
  );
}

ReferencesSection.propTypes = {
  references: PropTypes.array.isRequired,
  title: PropTypes.string,
};
