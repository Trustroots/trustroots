// External dependencies
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import Reference from './Reference';

/**
 * List of user's references
 */
export default function ReferencesSection({ title, referencePairs }) {
  return (
    <section>
      {title && (
        <div className="row">
          <div className="col-xs-12 col-sm-6">
            <h4 className="text-muted">{title}</h4>
          </div>
        </div>
      )}
      {referencePairs.map(referencePair => (
        <div
          key={
            referencePair.sharedWithUser
              ? referencePair.sharedWithUser._id
              : referencePair.writtenByUser._id
          }
        >
          {referencePair.sharedWithUser && (
            <div className="row">
              <div className="col-xs-12">
                <Reference
                  reference={referencePair.sharedWithUser}
                  inRecipientProfile={true}
                />
              </div>
            </div>
          )}
          {referencePair.writtenByUser && (
            <div className="row">
              <div className="col-xs-12">
                <Reference
                  reference={referencePair.writtenByUser}
                  inRecipientProfile={false}
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

ReferencesSection.propTypes = {
  referencePairs: PropTypes.array.isRequired,
  title: PropTypes.string,
};
