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
export default function ListReferences({ profile, authenticatedUser }) {
  const { t } = useTranslation('references');
  const [publicReferences, setPublicReferences] = useState([]);
  const [pendingReferences, setPendingReferences] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchReferences() {
    setIsLoading(true);
    try {
      const references = await readReferences({
        userTo: profile._id,
      });

      const publicNewestFirst = references.filter(
        reference => reference.public,
      );

      const pendingNewestFirst = references.filter(
        reference => !reference.public,
      );
      const pendingOldestFirst = [...pendingNewestFirst].reverse();

      setPublicReferences(publicNewestFirst);
      setPendingReferences(pendingOldestFirst);
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

  // No references
  if (pendingReferences.length === 0 && publicReferences.length === 0) {
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
            <Reference key={reference._id} reference={reference} />
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
  profile: PropTypes.object.isRequired,
  authenticatedUser: PropTypes.object.isRequired,
};
