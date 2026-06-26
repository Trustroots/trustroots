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
      <div className="container">
        <h2>Acquisition stories</h2>
        <p>Based on latest 3000 stories</p>

        <AdminAcquisitionStoriesMenu active="stories" />

        {isLoading && <LoadingIndicator />}

        {!isLoading &&
          stories.length > 0 &&
          stories.map((story, index) => (
            <div
              key={story._id}
              className="panel"
              id={`acquisition-story-${index + 1}`}
            >
              <div className="panel-body">
                <p className="lead">{story.acquisitionStory}</p>
                <ul className="list-inline">
                  <li>
                    <a href={`#acquisition-story-${index + 1}`}>
                      <time className="text-muted">{story.created}</time>
                    </a>
                  </li>
                  <li>
                    <UserLink user={story} />
                  </li>
                </ul>
              </div>
            </div>
          ))}

        {!isLoading && stories.length === 0 && (
          <p>No acquisition stories found.</p>
        )}
      </div>
    </>
  );
}

AdminAcquisitionStories.propTypes = {};
