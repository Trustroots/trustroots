import React, { useRef } from 'react';

import { useLanguagesQuery } from '@/modules/core/client/api/languages.api';
import Avatar from '@/modules/users/client/components/Avatar.component';
import CommunityNotesSidebar from './CommunityNotesSidebar.component';

interface SearchOfferUser {
  _id?: string;
  username: string;
  displayName?: string;
  birthdate?: string | number;
  gender?: string;
  tagline?: string;
  languages?: string[];
}

export interface SearchResultOffer {
  _id?: string;
  location?: [number, number];
  user: SearchOfferUser;
  type: 'host' | 'meet';
  status?: string;
  description?: string;
  updated?: string | number;
}

export interface CommunityNoteSummary {
  notes: import('nostr-tools').Event[];
  plusCode: string | null;
}

interface SearchSidebarResultsProps {
  communityNote?: CommunityNoteSummary | null;
  isLoadingOffer?: boolean;
  offer?: SearchResultOffer | null;
  offers?: SearchResultOffer[];
  communityNoteThreads?: CommunityNoteSummary[];
  onOfferSelect?: (offer: SearchResultOffer) => void;
  onCommunityNoteSelect?: (note: CommunityNoteSummary) => void;
  onBackToOffers?: () => void;
  isLoadingOffers?: boolean;
  onCloseSidebar: () => void;
}

interface OfferDescriptionProps {
  description?: string;
  offerType?: string;
}

export function formatAge(birthdate?: string | number | null) {
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

export function OfferDescription({
  description,
  offerType,
}: OfferDescriptionProps) {
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

export default function SearchSidebarResults({
  communityNote,
  isLoadingOffer,
  offer,
  offers = [],
  communityNoteThreads = [],
  onOfferSelect = () => {},
  onCommunityNoteSelect = () => {},
  onBackToOffers = () => {},
  isLoadingOffers,
  onCloseSidebar,
}: SearchSidebarResultsProps) {
  /* istanbul ignore next -- the language query always returns its cache object. */
  const languageQuery = useLanguagesQuery() as {
    data?: Record<string, string>;
  };
  const languageNames = languageQuery.data || {};
  const selectedResultId = useRef<string | undefined>();
  const showList = !offer && !isLoadingOffer && !communityNote;

  const renderResultButton = (
    resultId: string,
    ariaLabel: string,
    onSelect: () => void,
    children: React.ReactNode,
  ) => (
    <li key={resultId}>
      <button
        aria-label={ariaLabel}
        className="panel panel-default search-result-list-item"
        data-result-id={resultId}
        onClick={() => {
          selectedResultId.current = resultId;
          onSelect();
        }}
        type="button"
      >
        {children}
      </button>
    </li>
  );

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

      {showList && offers.length > 0 && (
        <ul aria-label="Visible search results" className="search-result-list">
          {offers.map(item =>
            renderResultButton(
              item._id!,
              `Open ${item.type === 'host' ? 'hosting' : 'meet'} offer from ${
                item.user.displayName || item.user.username
              }`,
              () => onOfferSelect(item),
              <>
                <Avatar link={false} size={32} user={item.user} />
                <span>
                  <strong>{item.user.displayName || item.user.username}</strong>
                  <span className="text-muted"> @{item.user.username}</span>
                  <br />
                  {item.type === 'host' ? 'Hosting' : 'Meet'}
                  {item.type === 'host' && item.status && ` · ${item.status}`}
                </span>
              </>,
            ),
          )}
        </ul>
      )}

      {showList && communityNoteThreads.length > 0 && (
        <ul
          aria-label="Visible community note results"
          className="search-result-list"
        >
          {communityNoteThreads.map(thread => {
            const firstNote = thread.notes[0];
            const resultId = thread.plusCode || firstNote?.id || '';
            return renderResultButton(
              resultId,
              `Open community note thread at ${
                thread.plusCode || 'map location'
              }`,
              () => onCommunityNoteSelect(thread),
              <span>
                <strong>Community note</strong>
                <span className="text-muted">
                  {thread.plusCode ? ` · ${thread.plusCode}` : ''}
                </span>
                <br />
                {firstNote?.content?.slice(0, 140) || 'Open note thread'}
              </span>,
            );
          })}
        </ul>
      )}

      {showList && offers.length === 0 && communityNoteThreads.length === 0 && (
        <section
          aria-label="Search results: no results are visible in this map area."
          aria-live="polite"
          className="content-empty text-muted text-center"
          tabIndex={0}
        >
          <br />
          <br />
          <em>
            {isLoadingOffers
              ? 'Loading visible offers…'
              : 'No results are visible in this map area.'}
          </em>
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
            {Boolean(offer.user.languages?.length) && (
              <div className="search-result-languages">
                <h4>Languages</h4>
                <ul className="list-inline">
                  {offer.user.languages?.map(code => (
                    <li key={code}>{languageNames[code] || code}</li>
                  ))}
                </ul>
              </div>
            )}
          </a>
        </div>
      )}

      {(offer || communityNote) && (
        <button
          className="btn btn-default search-results-back"
          onClick={() => {
            onBackToOffers();
            window.requestAnimationFrame(() => {
              const resultButtons = Array.from(
                document.querySelectorAll<HTMLButtonElement>(
                  '[data-result-id]',
                ),
              );
              resultButtons
                .find(
                  button =>
                    button.dataset.resultId === selectedResultId.current,
                )
                ?.focus();
            });
          }}
          type="button"
        >
          Back to results
        </button>
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
