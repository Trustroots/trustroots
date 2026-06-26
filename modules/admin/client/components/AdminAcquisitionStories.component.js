// External dependencies
import React, { useState, useEffect } from 'react';

// Internal dependencies
import { getAcquisitionStories } from '../api/acquisition-stories.api';
import AdminAcquisitionStoriesMenu from './AdminAcquisitionStoriesMenu';
import AdminHeader from './AdminHeader.component';
import UserLink from './UserLink.component';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';

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
                <th>Story</th>
                <th>Created</th>
                <th>Member</th>
              </tr>
            </thead>
            <tbody>
              {stories.map((story, index) => (
                <tr key={story._id} id={`acquisition-story-${index + 1}`}>
                  <td>{story.acquisitionStory}</td>
                  <td>
                    <a href={`#acquisition-story-${index + 1}`}>
                      <time className="text-muted">{story.created}</time>
                    </a>
                  </td>
                  <td>
                    <UserLink user={story} />
                  </td>
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
