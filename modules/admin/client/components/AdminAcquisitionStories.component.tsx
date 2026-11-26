import { Input } from '@trustroots/ui/Input';
import { Select } from '@trustroots/ui/Select';
import { useAuth } from '@trustroots/core/auth';
import React, { useMemo, useState, useEffect } from 'react';
import { Badge } from '@trustroots/ui/Badge';

// Internal dependencies
import {
  flagAcquisitionStoryMember,
  getAcquisitionStories,
  resendAcquisitionStoryConfirmation,
} from '../api/acquisition-stories.api';
import { getErrorMessage } from '@trustroots/core/http-client';
import AdminHeader from './AdminHeader.component';
import UserLink from './UserLink.component';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import LanguageList from '@/modules/users/client/components/LanguageList';
import { Tooltip } from '@trustroots/ui/Tooltip';
import {
  formatAdminDateTime,
  getAdminDateTimeAttribute,
} from '../utils/admin-date';
import { Button } from '@trustroots/ui/Button';

type StorySortColumn =
  | 'acquisitionStory'
  | 'circleCount'
  | 'created'
  | 'member'
  | 'public'
  | 'welcomer';
type SortDirection = 'ascending' | 'descending';
type ProfileVisibility = 'all' | 'visible' | 'hidden';
type RestrictionStatus = 'suspended' | 'shadowban';

function RestrictionBadges({
  statuses = [],
}: {
  statuses?: RestrictionStatus[];
}) {
  return (
    <span className="admin-restriction-badges">
      {statuses.map(status => (
        <Badge variant="solid" intent="danger" key={status}>
          {status === 'suspended' ? 'Suspended' : 'Shadowbanned'}
        </Badge>
      ))}
    </span>
  );
}

interface RestrictedMatch {
  _id: string;
  username: string;
  displayName?: string;
  matchReasons: string[];
  restrictionStatuses?: RestrictionStatus[];
}

interface AcquisitionStory {
  _id: string;
  created: string | number;
  username: string;
  displayName?: string;
  email?: string;
  circleCount: number;
  locationLiving?: string;
  locationFrom?: string;
  hostingLocation?: number[];
  acquisitionStory?: string;
  public?: boolean;
  emailConfirmed: boolean;
  flagged?: boolean;
  restrictionStatuses?: RestrictionStatus[];
  restrictedMatches?: RestrictedMatch[];
  languages?: string[];
  welcomer?: {
    _id: string;
    username: string;
    displayName?: string;
    created: string;
  } | null;
}

interface StorySort {
  column: StorySortColumn;
  direction: SortDirection;
}

interface StorySortableHeaderProps {
  column: StorySortColumn;
  label: string;
  onSort: (column: StorySortColumn) => void;
  sort: StorySort;
  tooltip: string;
}

interface StaticHeaderProps {
  label: string;
  tooltip: string;
}

function isProfileVisible(story: AcquisitionStory) {
  return (
    story.public === true && !story.restrictionStatuses?.includes('shadowban')
  );
}

function formatCoordinates(value?: number[] | null) {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }

  return value
    .slice(0, 2)
    .map(coordinate => Number(coordinate).toFixed(3))
    .join(', ');
}

const storySortValues: Record<
  StorySortColumn,
  (story: AcquisitionStory) => string | number
> = {
  acquisitionStory: story => String(story.acquisitionStory || '').toLowerCase(),
  circleCount: story => Number(story.circleCount) || 0,
  created: story => {
    const timestamp = new Date(story.created).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  },
  member: story => String(story.username).toLowerCase(),
  public: story => Number(isProfileVisible(story)),
  welcomer: story => (story.welcomer ? 1 : 0),
};

function SortableHeader({
  column,
  label,
  onSort,
  sort,
  tooltip,
}: StorySortableHeaderProps) {
  const isActive = sort.column === column;
  const direction = isActive ? sort.direction : 'none';

  return (
    <th aria-sort={direction}>
      <Tooltip placement="bottom" tooltip={tooltip}>
        <Button
          variant="link"
          className="admin-acquisition-stories-sort"
          onClick={() => onSort(column)}
          type="button"
        >
          {label}
          {isActive && (sort.direction === 'ascending' ? ' ▲' : ' ▼')}
        </Button>
      </Tooltip>
    </th>
  );
}

function StaticHeader({ label, tooltip }: StaticHeaderProps) {
  return (
    <th>
      <Tooltip placement="bottom" tooltip={tooltip}>
        {/* Keep the explanatory tooltip reachable without suggesting sorting. */}
        {/* eslint-disable jsx-a11y/no-noninteractive-tabindex */}
        <span
          aria-label={`${label}: ${tooltip}`}
          className="admin-acquisition-stories-header-help"
          tabIndex={0}
        >
          {label}
        </span>
        {/* eslint-enable jsx-a11y/no-noninteractive-tabindex */}
      </Tooltip>
    </th>
  );
}

export default function AdminAcquisitionStories() {
  const { user, hasRole } = useAuth();
  const viewerLanguages = user?.languages || [];
  const isAdmin = hasRole('admin');
  const isGreeter = hasRole('welcome-team');
  const publicProfile = !isAdmin;
  const [stories, setStories] = useState<AcquisitionStory[]>([]);
  const [sendingConfirmationIds, setSendingConfirmationIds] = useState<
    Set<string>
  >(() => new Set());
  const [confirmationFeedback, setConfirmationFeedback] = useState<
    Record<string, { kind: 'success' | 'error'; message: string }>
  >({});
  const [flagRequests, setFlagRequests] = useState<
    Record<string, 'pending' | 'failed' | undefined>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const searchTerm = search.trim().toLowerCase();
  const [unassignedOnly, setUnassignedOnly] = useState(true);
  const [profileVisibility, setProfileVisibility] =
    useState<ProfileVisibility>('visible');
  const [sort, setSort] = useState<StorySort>({
    column: 'created',
    direction: 'descending',
  });

  useEffect(() => {
    async function loadAcquisitionStories() {
      const acquisitionStories = await getAcquisitionStories();
      setStories(acquisitionStories || []);
      setIsLoading(false);
    }

    loadAcquisitionStories();
  }, []);

  const sortedStories = useMemo(() => {
    const direction = sort.direction === 'ascending' ? 1 : -1;
    const valueFor = storySortValues[sort.column];

    return stories
      .filter(story => !unassignedOnly || !story.welcomer)
      .filter(
        story =>
          profileVisibility === 'all' ||
          isProfileVisible(story) === (profileVisibility === 'visible'),
      )
      .filter(
        story =>
          !searchTerm ||
          [
            story.username,
            story.displayName,
            isAdmin ? story.email : undefined,
            story.locationLiving,
            story.locationFrom,
            story.acquisitionStory,
          ].some(value => value?.toLowerCase().includes(searchTerm)),
      )
      .sort((left, right) => {
        const leftValue = valueFor(left);
        const rightValue = valueFor(right);
        const comparison =
          typeof leftValue === 'number' && typeof rightValue === 'number'
            ? leftValue - rightValue
            : String(leftValue).localeCompare(String(rightValue));
        return comparison * direction;
      });
  }, [isAdmin, profileVisibility, searchTerm, sort, stories, unassignedOnly]);

  function sortBy(column: StorySortColumn) {
    setSort(currentSort => ({
      column,
      direction:
        currentSort.column === column && currentSort.direction === 'ascending'
          ? 'descending'
          : 'ascending',
    }));
  }

  async function flagStory(story: AcquisitionStory) {
    setFlagRequests(current => ({ ...current, [story._id]: 'pending' }));
    try {
      await flagAcquisitionStoryMember(story._id);
      setStories(current =>
        current.map(candidate =>
          candidate._id === story._id
            ? { ...candidate, flagged: true }
            : candidate,
        ),
      );
      setFlagRequests(current => ({ ...current, [story._id]: undefined }));
    } catch {
      setFlagRequests(current => ({ ...current, [story._id]: 'failed' }));
    }
  }

  async function resendConfirmation(story: AcquisitionStory) {
    setSendingConfirmationIds(current => new Set(current).add(story._id));
    setConfirmationFeedback(current => {
      const next = { ...current };
      delete next[story._id];
      return next;
    });

    try {
      const { message } = await resendAcquisitionStoryConfirmation(story._id);
      setConfirmationFeedback(current => ({
        ...current,
        [story._id]: {
          kind: 'success',
          message: message || 'Confirmation email sent.',
        },
      }));
    } catch (error: unknown) {
      setConfirmationFeedback(current => ({
        ...current,
        [story._id]: {
          kind: 'error',
          message: getErrorMessage(error, 'Could not send confirmation email.'),
        },
      }));
    } finally {
      setSendingConfirmationIds(current => {
        const next = new Set(current);
        next.delete(story._id);
        return next;
      });
    }
  }

  return (
    <>
      <AdminHeader />
      <div className="tw:page-container admin-acquisition-stories-page">
        <h2>Acquisition stories</h2>
        <p>Based on latest 500 stories</p>

        <div className="tw:mb-4">
          <label className="tw:mb-2" htmlFor="acquisition-stories-search">
            Search stories
          </label>
          <Input
            id="acquisition-stories-search"
            onChange={event => setSearch(event.target.value)}
            placeholder={
              isAdmin
                ? 'Email, username, name, location or story'
                : 'Username, name, location or story'
            }
            type="search"
            value={search}
          />
        </div>

        <div className="tw:mb-4 tw:flex tw:min-h-[21px] tw:items-baseline tw:gap-1.5">
          <input
            checked={unassignedOnly}
            className="tw:relative tw:top-0.5 tw:size-3.5 tw:shrink-0 tw:accent-brand-primary"
            id="acquisition-stories-unassigned-only"
            onChange={event => setUnassignedOnly(event.target.checked)}
            type="checkbox"
          />
          <label htmlFor="acquisition-stories-unassigned-only">
            Unassigned only
          </label>
        </div>

        <div className="tw:mb-4">
          <label
            className="tw:mb-2"
            htmlFor="acquisition-stories-profile-visibility"
          >
            Profile visibility
          </label>
          <Select
            className="tw:appearance-auto tw:text-base"
            id="acquisition-stories-profile-visibility"
            onChange={event =>
              setProfileVisibility(event.target.value as ProfileVisibility)
            }
            value={profileVisibility}
          >
            <option value="all">All</option>
            <option value="visible">Visible</option>
            <option value="hidden">Hidden</option>
          </Select>
          <small className="text-muted tw:mt-1 tw:inline-block tw:text-[.875em]">
            Hidden profiles include unconfirmed signups and shadowbanned
            accounts.
          </small>
        </div>

        {isLoading && <LoadingIndicator />}

        {!isLoading && sortedStories.length > 0 && (
          <table className="table table-condensed table-striped admin-acquisition-stories-table">
            <thead>
              <tr>
                <SortableHeader
                  column="created"
                  label="Date"
                  onSort={sortBy}
                  sort={sort}
                  tooltip="Date the member signed up"
                />
                <SortableHeader
                  column="member"
                  label="Member"
                  onSort={sortBy}
                  sort={sort}
                  tooltip="The member's name and username"
                />
                {isAdmin && <th scope="col">Email address</th>}
                <SortableHeader
                  column="circleCount"
                  label="Circles"
                  onSort={sortBy}
                  sort={sort}
                  tooltip="Number of circles the member has joined"
                />
                <StaticHeader
                  label="Location"
                  tooltip="Living, origin, and latest hosting-offer locations"
                />
                <SortableHeader
                  column="acquisitionStory"
                  label="Story"
                  onSort={sortBy}
                  sort={sort}
                  tooltip="How the member heard about Trustroots during signup"
                />
                <SortableHeader
                  column="public"
                  label="Profile visible"
                  onSort={sortBy}
                  sort={sort}
                  tooltip="Whether the member's profile is visible to other members"
                />
                <StaticHeader
                  label="Email confirmed"
                  tooltip="Whether the member confirmed their signup email"
                />
                <StaticHeader
                  label="Restricted matches"
                  tooltip="Suspended or shadowbanned accounts with a matching username or email identifier"
                />
                <SortableHeader
                  column="welcomer"
                  label="Greeter"
                  onSort={sortBy}
                  sort={sort}
                  tooltip="First current greeter to send a message; sending a message assigns the greeter"
                />
                <StaticHeader
                  label="Languages"
                  tooltip="Shared languages appear first and in bold, except English"
                />
                {isGreeter && <th scope="col">Follow-up</th>}
              </tr>
            </thead>
            <tbody>
              {sortedStories.map((story, index) => (
                <tr
                  key={story._id}
                  id={`acquisition-story-${index + 1}`}
                  className={
                    story.welcomer
                      ? 'admin-acquisition-stories-contacted'
                      : undefined
                  }
                >
                  <td>
                    <a href={`#acquisition-story-${index + 1}`}>
                      <time
                        className="text-muted"
                        dateTime={getAdminDateTimeAttribute(story.created)}
                      >
                        {formatAdminDateTime(story.created)}
                      </time>
                    </a>
                  </td>
                  <td>
                    <div className="admin-acquisition-stories-member">
                      <a
                        aria-label={`Open public profile for ${
                          story.displayName || story.username
                        }`}
                        href={`/profile/${story.username}`}
                      >
                        <img
                          alt=""
                          aria-hidden="true"
                          className="avatar avatar-32"
                          loading="lazy"
                          src={`/api/users/${story._id}/avatar?size=32`}
                        />
                      </a>
                      <UserLink
                        publicProfile={publicProfile}
                        user={{
                          _id: story._id,
                          displayName: story.displayName,
                          username: story.username,
                        }}
                      />
                      <RestrictionBadges statuses={story.restrictionStatuses} />
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="admin-acquisition-stories-email">
                      {story.email || '—'}
                    </td>
                  )}
                  <td>{story.circleCount || 0}</td>
                  <td>
                    {story.locationLiving && (
                      <div>Living: {story.locationLiving}</div>
                    )}
                    {story.locationFrom && (
                      <div>From: {story.locationFrom}</div>
                    )}
                    {formatCoordinates(story.hostingLocation) && (
                      <div>
                        Hosting: {formatCoordinates(story.hostingLocation)}
                      </div>
                    )}
                  </td>
                  <td>{story.acquisitionStory}</td>
                  <td>{isProfileVisible(story) ? 'Visible' : 'Hidden'}</td>
                  <td>
                    <span>
                      {story.emailConfirmed === true
                        ? 'Confirmed'
                        : 'Not confirmed'}
                    </span>
                    {story.emailConfirmed === false && (
                      <div>
                        <Button
                          disabled={sendingConfirmationIds.has(story._id)}
                          onClick={() => resendConfirmation(story)}
                          type="button"
                        >
                          {sendingConfirmationIds.has(story._id)
                            ? 'Sending…'
                            : 'Send confirmation'}
                        </Button>
                      </div>
                    )}
                    {confirmationFeedback[story._id] && (
                      <p
                        aria-live="polite"
                        role={
                          confirmationFeedback[story._id].kind === 'error'
                            ? 'alert'
                            : 'status'
                        }
                      >
                        {confirmationFeedback[story._id].message}
                      </p>
                    )}
                  </td>
                  <td>
                    {(story.restrictedMatches || []).map(match => (
                      <div key={match._id}>
                        <UserLink user={match} publicProfile={publicProfile} />
                        <RestrictionBadges
                          statuses={match.restrictionStatuses}
                        />
                        <small className="text-muted">
                          {' '}
                          — {match.matchReasons.join(', ')}
                        </small>
                      </div>
                    ))}
                  </td>
                  <td>
                    {story.welcomer ? (
                      <>
                        <UserLink
                          user={story.welcomer}
                          publicProfile={publicProfile}
                        />
                        <div>
                          <time dateTime={story.welcomer.created}>
                            {formatAdminDateTime(story.welcomer.created)}
                          </time>
                        </div>
                      </>
                    ) : (
                      'Unassigned'
                    )}
                  </td>
                  <td>
                    {story.languages?.length ? (
                      <LanguageList
                        className="list-unstyled"
                        languages={[
                          ...story.languages.filter(code =>
                            viewerLanguages.includes(code),
                          ),
                          ...story.languages.filter(
                            code => !viewerLanguages.includes(code),
                          ),
                        ]}
                        emphasisedLanguages={story.languages.filter(
                          code =>
                            code !== 'eng' && viewerLanguages.includes(code),
                        )}
                      />
                    ) : (
                      'Not specified'
                    )}
                  </td>
                  {isGreeter && (
                    <td>
                      {story.flagged ? (
                        <span role="status">Flagged for follow-up</span>
                      ) : (
                        story._id !== user?._id && (
                          <Button
                            aria-label={`Flag ${story.username} for follow-up`}
                            disabled={flagRequests[story._id] === 'pending'}
                            onClick={() => flagStory(story)}
                            type="button"
                          >
                            {flagRequests[story._id] === 'pending'
                              ? 'Flagging…'
                              : 'Flag for follow-up'}
                          </Button>
                        )
                      )}
                      {flagRequests[story._id] === 'failed' && (
                        <p role="alert">
                          Could not flag this account. Please try again.
                        </p>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!isLoading && sortedStories.length === 0 && (
          <p>
            {searchTerm
              ? 'No acquisition stories match your search.'
              : unassignedOnly && stories.length > 0
                ? 'No unassigned acquisition stories found.'
                : 'No acquisition stories found.'}
          </p>
        )}
      </div>
    </>
  );
}
