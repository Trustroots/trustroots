// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

// Internal dependencies
import Reference from './Reference';

const PlaceholderReference = styled.div`
  padding: 10px;
  background: transparent;
  font-style: italic;
`;

/**
 * List of user's references
 */
export default function ReferencesSection({ title, referencePairs }) {
  const { t } = useTranslation('references');

  return (
    <section>
      {title && (
        <div className="row">
          <div className="col-xs-12 col-sm-6">
            <h4 className="text-muted">{title}</h4>
          </div>
        </div>
      )}
      {referencePairs.map(({ sharedWithUser, writtenByUser }) => (
        <div key={sharedWithUser?._id || writtenByUser._id}>
          <div className="row">
            <div className="col-xs-12">
              {sharedWithUser ? (
                <Reference reference={sharedWithUser} inRecipientProfile />
              ) : (
                <PlaceholderReference className="panel panel-default">
                  {t('They did not share their experience yet.')}
                </PlaceholderReference>
              )}
            </div>
          </div>
          {writtenByUser && (
            <div className="row">
              <div className="col-xs-12">
                <Reference
                  reference={writtenByUser}
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
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
};
