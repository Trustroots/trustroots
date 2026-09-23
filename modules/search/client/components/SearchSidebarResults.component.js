import PropTypes from 'prop-types';
import React from 'react';

import { useLanguagesQuery } from '@/modules/core/client/api/languages.api';
import Avatar from '@/modules/users/client/components/Avatar.component';
import CommunityNotesSidebar from './CommunityNotesSidebar.component';

export function formatAge(birthdate) {
  if (!birthdate) {
    return '';
  }

  const birth = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age;
}

export function OfferDescription({ description, offerType }) {
  if (!description) {
    return null;
  }

  if (description.length < 1000 || offerType === 'meet') {
    return (
      <div
        className="search-result-description"
        dangerouslySetInnerHTML={{ __html: description }}
      />
    );
  }

  return (
    <div className="search-result-description">
      <div className="panel-more-wrap">
        <div
          className="panel-more-excerpt"
          dangerouslySetInnerHTML={{
            __html: description.slice(0, 1000),
          }}
        />
        <div
          aria-label="Open profile to see the rest of the description"
          className="panel-more-fade"
        >
          Show more...
        </div>
      </div>
    </div>
  );
}

OfferDescription.propTypes = {
  description: PropTypes.string,
  offerType: PropTypes.string,
};

export default function SearchSidebarResults({
  communityNote,
  isLoadingOffer,
  offer,
  onCloseSidebar,
}) {
  /* istanbul ignore next -- the language query always returns its cache object. */
  const { data: languageNames = {} } = useLanguagesQuery();

  return (
    <section className="search-sidebar-results">
      {communityNote && (
        <div aria-live="polite">
          <CommunityNotesSidebar
            notes={communityNote.notes}
            plusCode={communityNote.plusCode}
          />
        </div>
      )}

      {!offer && !isLoadingOffer && !communityNote && (
        <section
          aria-label="Search results: nothing selected, please choose offers from the map to load them here."
          aria-live="polite"
          className="content-empty text-muted text-center"
          tabIndex="0"
        >
          <br />
          <br />
          <em>Choose something from the map.</em>
        </section>
      )}

      {!offer && isLoadingOffer && (
        <div
          aria-live="polite"
          className="search-result panel panel-default panel-loading"
        >
          <div aria-hidden="true" className="panel-body">
            <h4>
              ███ ███
              <small className="text-muted">@███</small>
            </h4>
          </div>
        </div>
      )}

      {offer && !isLoadingOffer && (
        <div
          aria-live="polite"
          aria-relevant="additions removals"
          className="search-result panel panel-default"
        >
          <a className="panel-body" href={`/profile/${offer.user.username}`}>
            <Avatar link={false} size={32} user={offer.user} />
            <h4>
              {offer.user.displayName}
              <small className="text-muted"> @{offer.user.username} </small>
            </h4>
            <div className="search-result-meta">
              {offer.user.birthdate && (
                <span>{formatAge(offer.user.birthdate)}</span>
              )}
              {offer.user.birthdate && offer.user.gender && ', '}
              {offer.user.gender && (
                <span
                  className={
                    offer.user.birthdate ? undefined : 'text-capitalize'
                  }
                >
                  {offer.user.gender}.
                </span>
              )}
            </div>
            {offer.user.tagline && offer.type !== 'meet' && (
              <div className="search-result-tagline">{offer.user.tagline}</div>
            )}
            <div className="search-result-hosting">
              {offer.type === 'host' && (
                <div
                  aria-label={`Hosting offer: ${offer.status}`}
                  className="search-result-label"
                >
                  Hosting:{' '}
                  <span
                    aria-hidden="true"
                    className={`label ${
                      offer.status === 'yes'
                        ? 'btn-offer-hosting-yes'
                        : offer.status === 'maybe'
                        ? 'btn-offer-hosting-maybe'
                        : ''
                    }`}
                  >
                    {offer.status}
                  </span>
                </div>
              )}
              {offer.type === 'meet' && (
                <div aria-label="Meet offer" className="search-result-label">
                  <span className="label btn-offer-meet"> Meet </span>
                </div>
              )}
              <OfferDescription
                description={offer.description}
                offerType={offer.type}
              />
              {offer.type === 'meet' && offer.updated && (
                <div className="text-muted">
                  Updated {new Date(offer.updated).toLocaleDateString()}
                </div>
              )}
            </div>
            {offer.user.languages?.length > 0 && (
              <div className="search-result-languages">
                <h4>Languages</h4>
                <ul className="list-inline">
                  {offer.user.languages.map(code => (
                    <li key={code}>{languageNames[code] || code}</li>
                  ))}
                </ul>
              </div>
            )}
          </a>
        </div>
      )}

      <button
        className="btn btn-action btn-primary visible-xs-block search-sidebar-close"
        onClick={onCloseSidebar}
        type="button"
      >
        Back to map
      </button>
    </section>
  );
}

SearchSidebarResults.propTypes = {
  communityNote: PropTypes.object,
  isLoadingOffer: PropTypes.bool,
  offer: PropTypes.object,
  onCloseSidebar: PropTypes.func.isRequired,
};
