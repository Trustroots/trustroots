import RichText from '@/modules/core/client/components/RichText';
import { plainText } from '@/modules/core/client/utils/filters';
import React, { useRef } from 'react';
import { latLng } from 'leaflet';
import { useTranslation } from 'react-i18next';
import { match, P } from 'ts-pattern';
import { Badge } from '@trustroots/ui/Badge';
import { Button } from '@trustroots/ui/Button';
import { rememberOutreachSource } from '@trustroots/analytics/client';

import { useLanguagesQuery } from '@/modules/core/client/api/languages.api';
import MemberIdentity from '@/modules/users/client/components/MemberIdentity';
import CityHostControls, { type CityResults } from './CityHostControls';
import CommunityNotesSidebar from './CommunityNotesSidebar.component';
import type {
  MeetingStatus,
  PlaceHostActivity,
  PlaceHostResult,
  OfferStatus,
  OfferType,
} from '@/modules/offers/shared/offer';
import { hostStatusIntent } from '@/modules/offers/client/components/hostStatusIntent';
import { hostStatusLabel } from '@/modules/offers/client/components/hostStatusLabel';

interface SearchOfferUser {
  _id?: string;
  username: string;
  displayName?: string;
  birthdate?: string | null;
  gender?: string;
  tagline?: string;
  languages?: string[];
}

export interface SearchResultOffer {
  _id?: string;
  location?: [number, number];
  user: SearchOfferUser;
  type: OfferType;
  noOfferDescription?: string;
  meetingStatus?: MeetingStatus;
  status?: OfferStatus;
  description?: string;
  volunteering?: boolean;
  updated?: string;
}

function getAvailability(
  { type, status, meetingStatus }: SearchResultOffer,
  t: (key: string) => string,
) {
  const meetingLabel = match(meetingStatus)
    .with('yes', () => t('Happy to meet'))
    .with('maybe', () => t('Might meet'))
    .with(P.union('no', 'not-set', undefined), () => undefined)
    .exhaustive();
  const showHosting = type === 'host' && !(status === 'no' && meetingLabel);
  const hosting =
    showHosting && status
      ? { label: hostStatusLabel(status, t), intent: hostStatusIntent[status] }
      : undefined;

  return { hosting, meetingLabel, showHosting };
}

export interface CommunityNoteSummary {
  notes: import('nostr-tools').Event[];
  plusCode: string | null;
}

interface SearchSidebarResultsProps {
  cityResults?: CityResults;
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
      <RichText className="search-result-description" content={description} />
    );
  }

  return (
    <div className="search-result-description">
      <div className="panel-more-wrap">
        <div className="panel-more-excerpt">
          {plainText(description).slice(0, 1000)}
        </div>
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

const activityLabels: Record<PlaceHostActivity, string> = {
  'past-month': 'Past month',
  'past-six-months': 'Past 6 months',
  'past-two-years': 'Past 2 years',
  older: 'Longer ago',
};

function CityHostRow({
  host,
  city,
  translateStatus,
  onSelect,
}: {
  host: PlaceHostResult;
  city: CityResults['city'];
  translateStatus: (key: string) => string;
  onSelect: () => void;
}) {
  const { hosting } = getAvailability(host, translateStatus);
  const name = host.user.displayName || host.user.username;
  const kilometres = Math.round(
    latLng(city.centre.lat, city.centre.lng).distanceTo(
      latLng(...host.location),
    ) / 1000,
  );

  return (
    <tr className="tw:relative tw:border-t tw:border-(--tr-control-border) tw:hover:bg-(--tr-success-bg-subtle) tw:focus-within:bg-(--tr-success-bg-subtle)">
      <td className="tw:px-2.5 tw:py-2.5">
        <button
          aria-label={
            hosting
              ? `Open hosting offer from ${name} · ${hosting.label}`
              : `Open hosting offer from ${name}`
          }
          className="tw:block tw:w-full tw:cursor-pointer tw:border-0 tw:bg-transparent tw:p-0 tw:text-left tw:after:absolute tw:after:inset-0"
          data-result-id={host._id}
          onClick={onSelect}
          type="button"
        >
          <MemberIdentity size={32} user={host.user} />
        </button>
        <div className="tw:mt-1.5 tw:flex tw:flex-wrap tw:gap-1">
          {hosting ? (
            <Badge
              variant="solid"
              intent={hosting.intent}
              className="tw:whitespace-normal"
            >
              {hosting.label}
            </Badge>
          ) : (
            <span className="tw:text-xs">Hosting</span>
          )}
          {host.volunteering === true && (
            <Badge
              variant="outline"
              intent="info"
              className="tw:whitespace-normal"
            >
              Offers volunteering
            </Badge>
          )}
        </div>
        <div className="tw:mt-1 tw:text-xs tw:text-(--tr-secondary-text)">
          {host.age ? `Age ${host.age} · ` : ''}
          {kilometres === 0
            ? 'Near the centre'
            : `About ${kilometres} km from centre`}
        </div>
      </td>
      <td className="tw:px-1.5 tw:text-xs">{activityLabels[host.activity]}</td>
      <td className="tw:px-2 tw:text-center tw:font-semibold tw:tabular-nums">
        {host.experienceCount}
      </td>
    </tr>
  );
}

export default function SearchSidebarResults({
  cityResults,
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
  const { t } = useTranslation('offers');
  /* istanbul ignore next -- the language query always returns its cache object. */
  const languageQuery = useLanguagesQuery() as {
    data?: Record<string, string>;
  };
  const languageNames = languageQuery.data || {};
  const translateStatus = (key: string) => String(t(key));
  const selectedAvailability = offer && getAvailability(offer, translateStatus);
  const selectedResultId = useRef<string | undefined>(undefined);
  const showList = !offer && !isLoadingOffer && !communityNote;
  const cityList = cityResults?.active ? cityResults : undefined;
  const cityQuery = cityList?.query;
  const cityOffers = cityQuery?.data?.pages.flatMap(page => page.offers) ?? [];
  const cityRows = Array.from(
    new Map(cityOffers.map(host => [host._id, host])).values(),
  );

  const renderResultButton = (
    resultId: string,
    ariaLabel: string,
    onSelect: () => void,
    children: React.ReactNode,
    memberSurface = false,
  ) => (
    <li key={resultId}>
      <button
        aria-label={ariaLabel}
        className={`search-result-list-item ${
          memberSurface ? 'member-card-surface' : 'panel panel-default'
        }`}
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
    <section
      aria-label="Search results"
      aria-busy={Boolean(
        (cityQuery ? cityQuery.isFetching : isLoadingOffers) || isLoadingOffer,
      )}
      className="search-sidebar-results"
    >
      {showList && cityResults && <CityHostControls {...cityResults} />}
      {showList && cityResults?.offerError && (
        <p role="alert">
          This offer could not be opened. Try again or choose another host.
        </p>
      )}
      {showList && !cityList && (
        <p role="status" className="sr-only">
          Offers in this map area: {offers.length}. Community note threads:{' '}
          {communityNoteThreads.length}.
        </p>
      )}
      {communityNote && (
        <div aria-live="polite">
          <CommunityNotesSidebar
            notes={communityNote.notes}
            plusCode={communityNote.plusCode}
          />
        </div>
      )}

      {showList && cityList && cityRows.length > 0 && (
        <div className="member-card-surface tw:mx-2.5 tw:mb-3 tw:overflow-hidden tw:p-0!">
          <table
            aria-label="City hosts"
            className="tw:w-full tw:table-fixed tw:text-sm"
          >
            <thead className="tw:bg-(--tr-secondary-bg) tw:text-xs tw:text-text">
              <tr>
                <th scope="col" className="tw:px-2.5 tw:py-2 tw:text-left">
                  Host
                </th>
                <th
                  scope="col"
                  className="tw:w-[22%] tw:px-1.5 tw:py-2 tw:text-left"
                >
                  Last active
                </th>
                <th
                  scope="col"
                  className="tw:w-24 tw:px-1 tw:py-2 tw:text-center tw:whitespace-nowrap"
                >
                  <span className="sr-only">Public </span>Experiences
                </th>
              </tr>
            </thead>
            <tbody>
              {cityRows.map(host => (
                <CityHostRow
                  key={host._id}
                  host={host}
                  city={cityList.city}
                  translateStatus={translateStatus}
                  onSelect={() => {
                    selectedResultId.current = host._id;
                    cityList.onSelectHost(host._id);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showList && !cityList && offers.length > 0 && (
        <ul aria-label="Visible search results" className="search-result-list">
          {offers.map(item => {
            const { hosting, meetingLabel, showHosting } = getAvailability(
              item,
              translateStatus,
            );
            const displayName = item.user.displayName || item.user.username;
            const offerKind = showHosting ? 'hosting' : 'meet';
            const resultName = [
              `Open ${offerKind} offer from ${displayName}`,
              hosting?.label,
              meetingLabel,
              item.type === 'host' && item.volunteering === true
                ? 'Offers volunteering'
                : undefined,
            ]
              .filter(Boolean)
              .join(' · ');

            return renderResultButton(
              item._id!,
              resultName,
              () => onOfferSelect(item),
              <span>
                <MemberIdentity size={32} user={item.user} />
                <span className="tw:flex tw:flex-wrap tw:items-center tw:gap-1">
                  {showHosting && !hosting && 'Hosting'}
                  {item.type === 'meet' && 'Meet'}
                  {hosting && (
                    <Badge variant="solid" intent={hosting.intent}>
                      {hosting.label}
                    </Badge>
                  )}
                  {item.type === 'host' && item.volunteering === true && (
                    <Badge variant="outline" intent="info">
                      Offers volunteering
                    </Badge>
                  )}
                  {meetingLabel && (
                    <Badge variant="solid" intent="info">
                      {meetingLabel}
                    </Badge>
                  )}
                </span>
              </span>,
              true,
            );
          })}
        </ul>
      )}

      {showList && cityQuery?.isPending && <p role="status">Loading hosts…</p>}
      {showList && cityQuery?.isSuccess && cityRows.length === 0 && (
        <p role="status">
          No hosts match these filters in {cityList?.city.name}.
        </p>
      )}
      {showList && cityQuery?.isError && (
        <p role="alert">
          Hosts could not be loaded.{' '}
          <Button
            type="button"
            onClick={() => {
              if (cityQuery.isFetchNextPageError)
                void cityQuery.fetchNextPage();
              else void cityQuery.refetch();
            }}
          >
            Try again
          </Button>
        </p>
      )}
      {showList && cityQuery?.hasNextPage && !cityQuery.isError && (
        <Button
          type="button"
          disabled={cityQuery.isFetching}
          onClick={() => void cityQuery.fetchNextPage()}
        >
          {cityQuery.isFetchingNextPage ? 'Loading hosts…' : 'Load more hosts'}
        </Button>
      )}

      {showList && !cityList && communityNoteThreads.length > 0 && (
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

      {showList &&
        !cityList &&
        offers.length === 0 &&
        communityNoteThreads.length === 0 && (
          <section
            aria-label="Search results: no results are visible in this map area."
            aria-live="polite"
            className="content-empty text-muted text-center"
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

      {offer && selectedAvailability && !isLoadingOffer && (
        <div
          aria-live="polite"
          aria-relevant="additions removals"
          className="search-result member-card-surface"
        >
          <a
            className="search-result-card"
            href={`/profile/${offer.user.username}`}
            onClick={() =>
              rememberOutreachSource(offer.user.username, 'search')
            }
          >
            <MemberIdentity size={36} user={offer.user} />
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
              {selectedAvailability.showHosting && (
                <div
                  aria-label={
                    selectedAvailability.hosting
                      ? `Hosting offer: ${selectedAvailability.hosting.label}`
                      : undefined
                  }
                  className="search-result-label"
                >
                  Hosting
                  {selectedAvailability.hosting && (
                    <>
                      :{' '}
                      <Badge
                        variant="solid"
                        intent={selectedAvailability.hosting.intent}
                      >
                        {selectedAvailability.hosting.label}
                      </Badge>
                    </>
                  )}
                </div>
              )}
              {offer.type === 'meet' && (
                <div aria-label="Meet offer" className="search-result-label">
                  <Badge variant="solid" intent="info">
                    Meet
                  </Badge>
                </div>
              )}
              {offer.type === 'host' && offer.volunteering === true && (
                <div className="search-result-label">
                  <Badge variant="outline" intent="info">
                    Offers volunteering
                  </Badge>
                </div>
              )}
              {selectedAvailability.meetingLabel && (
                <div className="search-result-label">
                  <Badge variant="solid" intent="info">
                    {selectedAvailability.meetingLabel}
                  </Badge>
                </div>
              )}
              <OfferDescription
                description={
                  offer.type === 'host' && offer.status === 'no'
                    ? offer.noOfferDescription
                    : offer.description
                }
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
        <Button
          className="search-results-back"
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
        </Button>
      )}

      <Button
        intent="primary"
        size="xl"
        className="tw:block tw:sm:hidden search-sidebar-close"
        onClick={onCloseSidebar}
        type="button"
      >
        Back to map
      </Button>
    </section>
  );
}
