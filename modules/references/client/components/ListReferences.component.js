// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';

// Internal dependencies
import { read as readReferences } from '../api/references.api';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import Reference from './read-references/Reference';
import ReferenceCounts from './read-references/ReferenceCounts';

/**
 * List of user's references
 */
export default function ListReferences({ user }) {
  const { t } = useTranslation('references');
  const [publicReferences, setPublicReferences] = useState([]);
  const [pendingReferences, setPendingReferences] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load references from api
  useEffect(async () => {
    setIsLoading(true);
    try {
      const references = await readReferences({
        userTo: user._id,
      });

      const filteredPublic = references
        .filter(reference => reference.public)
        .sort((a, b) => a.created < b.created);

      const filteredPending = references
        .filter(reference => !reference.public)
        .sort((a, b) => a.created > b.created);

      setPublicReferences(filteredPublic);
      setPendingReferences(filteredPending);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  // No references
  if (pendingReferences.length === 0 && publicReferences.length === 0) {
    return (
      <div className="row content-empty">
        <i className="icon-3x icon-users"></i>
        <h4>{t('No references yet.')}</h4>
        <a href={`/profile/${user.username}/references/new`}>
          {t('Write one!')}
        </a>
      </div>
    );
  }

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
      {publicReferences.length > 0 && (
        <ReferenceCounts publicReferences={publicReferences} />
      )}
      {pendingReferences.length > 0 &&
        renderReferencesSection(t('Pending'), pendingReferences)}
      {publicReferences.length > 0 &&
        renderReferencesSection(t('Public'), publicReferences)}
    </>
  );
}

ListReferences.propTypes = {
  user: PropTypes.object.isRequired,
};
