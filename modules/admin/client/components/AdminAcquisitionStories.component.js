// External dependencies
import React, { useState, useEffect } from 'react';

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

export default function AdminAcquisitionStories() {
  const [stories, setStories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAcquisitionStories() {
      const acquisitionStories = await getAcquisitionStories();
      setStories(acquisitionStories || []);
      setIsLoading(false);
    }

    loadAcquisitionStories();
  }, []);

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
                <th>Date</th>
                <th>Username</th>
                <th>Story</th>
              </tr>
            </thead>
            <tbody>
              {stories.map((story, index) => (
                <tr key={story._id} id={`acquisition-story-${index + 1}`}>
                  <td>
                    <a href={`#acquisition-story-${index + 1}`}>
                      <time className="text-muted">
                        {formatDate(story.created)}
                      </time>
                    </a>
                  </td>
                  <td>
                    <UserLink
                      user={{
                        _id: story._id,
                        displayName: story.displayName,
                        username: story.username,
                      }}
                    />
                  </td>
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
