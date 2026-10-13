// External dependencies
import PropTypes from 'prop-types';
import { getCurrentUser } from '../../../core/client/services/client-runtime';
import React, { useMemo, useState, useEffect } from 'react';

// Internal dependencies
import { getAcquisitionStories } from '../api/acquisition-stories.api';
import AdminHeader from './AdminHeader.component';
import UserLink from './UserLink.component';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import LanguageList from '@/modules/users/client/components/LanguageList';
import HoverTooltip from '@/modules/core/client/components/Tooltip';

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
    <>
      {statuses.map(status => (
        <span className="label label-danger admin-label" key={status}>
          {status === 'suspended' ? 'Suspended' : 'Shadowbanned'}
        </span>
      ))}
    </>
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
  circleCount: number;
  locationLiving?: string;
  locationFrom?: string;
  hostingLocation?: number[];
  acquisitionStory?: string;
  public?: boolean;
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

interface AccessibleTooltipProps {
  children: React.ReactNode;
  id: string;
  placement: string;
  tooltip: string;
}

const AccessibleTooltip =
  HoverTooltip as unknown as React.ComponentType<AccessibleTooltipProps>;

function formatDate(value?: string | number | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
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
  public: story => (story.public === true ? 1 : 0),
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
      <AccessibleTooltip
        id={`acquisition-stories-${column}-heading`}
        placement="bottom"
        tooltip={tooltip}
      >
        <button
          className="btn btn-link admin-acquisition-stories-sort"
          onClick={() => onSort(column)}
          type="button"
        >
          {label}
          {isActive && (sort.direction === 'ascending' ? ' ▲' : ' ▼')}
        </button>
      </AccessibleTooltip>
    </th>
  );
}

SortableHeader.propTypes = {
  column: PropTypes.oneOf(Object.keys(storySortValues)).isRequired,
  label: PropTypes.string.isRequired,
  onSort: PropTypes.func.isRequired,
  sort: PropTypes.shape({
    column: PropTypes.string.isRequired,
    direction: PropTypes.oneOf(['ascending', 'descending']).isRequired,
  }).isRequired,
  tooltip: PropTypes.string.isRequired,
};

function StaticHeader({ label, tooltip }: StaticHeaderProps) {
  return (
    <th>
      <AccessibleTooltip
        id={`acquisition-stories-${label
          .toLowerCase()
          .replace(/\s+/g, '-')}-heading`}
        placement="bottom"
        tooltip={tooltip}
      >
        <span
          aria-label={`${label}: ${tooltip}`}
          className="admin-acquisition-stories-header-help"
          tabIndex={0}
        >
          {label}
        </span>
      </AccessibleTooltip>
    </th>
  );
}

StaticHeader.propTypes = {
  label: PropTypes.string.isRequired,
  tooltip: PropTypes.string.isRequired,
};

export default function AdminAcquisitionStories() {
  const viewerLanguages = getCurrentUser()?.languages || [];
  const [stories, setStories] = useState<AcquisitionStory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [profileVisibility, setProfileVisibility] =
    useState<ProfileVisibility>('all');
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
          (profileVisibility === 'visible' && story.public === true) ||
          (profileVisibility === 'hidden' && story.public !== true),
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
  }, [profileVisibility, sort, stories, unassignedOnly]);

  function sortBy(column: StorySortColumn) {
    setSort(currentSort => ({
      column,
      direction:
        currentSort.column === column && currentSort.direction === 'ascending'
          ? 'descending'
          : 'ascending',
    }));
  }

  return (
    <>
      <AdminHeader />
      <div className="container admin-acquisition-stories-page">
        <h2>Acquisition stories</h2>
        <p>Based on latest 500 stories</p>

        <div className="form-check mb-3">
          <input
            checked={unassignedOnly}
            className="form-check-input"
            id="acquisition-stories-unassigned-only"
            onChange={event => setUnassignedOnly(event.target.checked)}
            type="checkbox"
          />
          <label
            className="form-check-label"
            htmlFor="acquisition-stories-unassigned-only"
          >
            Unassigned only
          </label>
        </div>

        <div className="mb-3">
          <label
            className="form-label"
            htmlFor="acquisition-stories-profile-visibility"
          >
            Profile visibility
          </label>
          <select
            className="form-select"
            id="acquisition-stories-profile-visibility"
            onChange={event =>
              setProfileVisibility(event.target.value as ProfileVisibility)
            }
            value={profileVisibility}
          >
            <option value="all">All</option>
            <option value="visible">Visible</option>
            <option value="hidden">Hidden</option>
          </select>
          <small className="form-text text-muted">
            Hidden profiles have not activated their signup through email
            confirmation.
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
                      <time className="text-muted">
                        {formatDate(story.created)}
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
                        publicProfile={
                          !(getCurrentUser()?.roles || []).includes('admin')
                        }
                        user={{
                          _id: story._id,
                          displayName: story.displayName,
                          username: story.username,
                        }}
                      />
                      <RestrictionBadges statuses={story.restrictionStatuses} />
                    </div>
                  </td>
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
                  <td>{story.public === true ? 'Visible' : 'Hidden'}</td>
                  <td>
                    {(story.restrictedMatches || []).map(match => (
                      <div key={match._id}>
                        <UserLink
                          user={match}
                          publicProfile={
                            !(getCurrentUser()?.roles || []).includes('admin')
                          }
                        />
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
                          publicProfile={
                            !(getCurrentUser()?.roles || []).includes('admin')
                          }
                        />
                        <div>
                          <time dateTime={story.welcomer.created}>
                            {formatDate(story.welcomer.created)}
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
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!isLoading && sortedStories.length === 0 && (
          <p>
            {unassignedOnly
              ? 'No unassigned acquisition stories found.'
              : 'No acquisition stories found.'}
          </p>
        )}
      </div>
    </>
  );
}

AdminAcquisitionStories.propTypes = {};
