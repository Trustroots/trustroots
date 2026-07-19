// External dependencies
import PropTypes from 'prop-types';
import React, { useMemo, useState, useEffect } from 'react';

// Internal dependencies
import { getAcquisitionStories } from '../api/acquisition-stories.api';
import AdminAcquisitionStoriesMenu from './AdminAcquisitionStoriesMenu';
import AdminHeader from './AdminHeader.component';
import UserLink from './UserLink.component';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';

function formatDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

const storySortValues = {
  acquisitionStory: story => String(story.acquisitionStory).toLowerCase(),
  circleCount: story => Number(story.circleCount) || 0,
  created: story => {
    const timestamp = new Date(story.created).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  },
  member: story => String(story.username).toLowerCase(),
};

function SortableHeader({ column, label, onSort, sort }) {
  const isActive = sort.column === column;
  const direction = isActive ? sort.direction : 'none';

  return (
    <th aria-sort={direction}>
      <button
        className="btn btn-link admin-acquisition-stories-sort"
        onClick={() => onSort(column)}
        type="button"
      >
        {label}
        {isActive && (sort.direction === 'ascending' ? ' ▲' : ' ▼')}
      </button>
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
};

export default function AdminAcquisitionStories() {
  const [stories, setStories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sort, setSort] = useState({
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

    return stories.slice().sort((left, right) => {
      const leftValue = valueFor(left);
      const rightValue = valueFor(right);
      const comparison =
        typeof leftValue === 'number'
          ? leftValue - rightValue
          : leftValue.localeCompare(rightValue);
      return comparison * direction;
    });
  }, [sort, stories]);

  function sortBy(column) {
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
        <p>Based on latest 3000 stories</p>

        <AdminAcquisitionStoriesMenu active="stories" />

        {isLoading && <LoadingIndicator />}

        {!isLoading && stories.length > 0 && (
          <table className="table table-condensed table-striped admin-acquisition-stories-table">
            <thead>
              <tr>
                <SortableHeader
                  column="created"
                  label="Date"
                  onSort={sortBy}
                  sort={sort}
                />
                <SortableHeader
                  column="member"
                  label="Member"
                  onSort={sortBy}
                  sort={sort}
                />
                <SortableHeader
                  column="circleCount"
                  label="Circles"
                  onSort={sortBy}
                  sort={sort}
                />
                <SortableHeader
                  column="acquisitionStory"
                  label="Story"
                  onSort={sortBy}
                  sort={sort}
                />
              </tr>
            </thead>
            <tbody>
              {sortedStories.map((story, index) => (
                <tr key={story._id} id={`acquisition-story-${index + 1}`}>
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
                        user={{
                          _id: story._id,
                          displayName: story.displayName,
                          username: story.username,
                        }}
                      />
                    </div>
                  </td>
                  <td>{story.circleCount || 0}</td>
                  <td>{story.acquisitionStory}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!isLoading && stories.length === 0 && (
          <p>No acquisition stories found.</p>
        )}
      </div>
    </>
  );
}

AdminAcquisitionStories.propTypes = {};
