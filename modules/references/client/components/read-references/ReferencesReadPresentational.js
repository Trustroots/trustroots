import { useTranslation, Trans } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';
import Reference from './Reference';

export default function ReferencesReadPresentational({
  publicReferences,
  nonpublicReferences,
}) {
  const { t } = useTranslation('reference');

  const hasAnyPublicReferences =
    publicReferences && publicReferences.length > 0;
  const hasAnyNonpublicReferences =
    nonpublicReferences && nonpublicReferences.length > 0;

  // No references
  if (!hasAnyNonpublicReferences && !hasAnyPublicReferences) {
    return (
      <div className="row content-empty">
        <i className="icon-3x icon-users"></i>
        <h4>{t('No references yet.')}</h4>
        <a href="">Write one!</a>
      </div>
    );
  }

  const renderReferenceCount = () => {
    const positiveCount = publicReferences.filter(
      ({ recommend }) => recommend === 'yes',
    ).length;
    const unknownCount = publicReferences.filter(
      ({ recommend }) => recommend === 'unknown',
    ).length;
    const negativeCount = publicReferences.filter(
      ({ recommend }) => recommend === 'no',
    ).length;

    return (
      <div className="panel panel-default">
        <div className="panel-body references-summary">
          <Trans
            ns="reference"
            negativeCount={negativeCount}
            positiveCount={positiveCount}
            unknownCount={unknownCount}
          >
            <span className="text-success">{{ positiveCount }} recommend</span>{' '}
            <span>{{ unknownCount }} unknown</span>{' '}
            <span className="text-danger">
              {{ negativeCount }} not recommend
            </span>
          </Trans>
        </div>
      </div>
    );
  };

  const renderReferencesSection = (sectionTitle, references) => (
    <section>
      <div className="row">
        <div className="col-xs-12 col-sm-6">
          <h4 className="text-muted">{sectionTitle}</h4>
        </div>
      </div>
      <div className="row">
        <div className="col-xs-12">
          {references.map(reference => (
            <Reference
              id={reference._id}
              key={reference._id}
              reference={reference}
            />
          ))}
        </div>
      </div>
    </section>
  );

  return (
    <>
      {publicReferences && renderReferenceCount()}
      {hasAnyNonpublicReferences &&
        renderReferencesSection(t('Pending'), nonpublicReferences)}
      {hasAnyPublicReferences &&
        renderReferencesSection(t('Public'), publicReferences)}
    </>
  );
}

ReferencesReadPresentational.propTypes = {
  user: PropTypes.object.isRequired,
  publicReferences: PropTypes.array.isRequired,
  nonpublicReferences: PropTypes.array,
};
