// External dependencies
import React, { useState, useEffect } from 'react';

// Internal dependencies
import { getAcquisitionStories } from '../api/acquisition-stories.api';
import AdminAcquisitionStoriesMenu from './AdminAcquisitionStoriesMenu';
import AdminHeader from './AdminHeader.component';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';

export default function AdminAcquisitionStories() {
  const [stories, setStories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(async () => {
    const acquisitionStories = await getAcquisitionStories();
    setStories(acquisitionStories || []);
    setIsLoading(false);
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
          stories.map(({ _id: userId, acquisitionStory, created }) => (
            <div key={userId} className="panel" id={userId}>
              <div className="panel-body">
                <p className="lead">{acquisitionStory}</p>
                <ul className="list-inline">
                  <li>
                    <a href={`#${userId}`}>
                      <time className="text-muted">{created}</time>
                    </a>
                  </li>
                  <li>
                    <a href={`/admin/user?id=${userId}`}>Member report card</a>
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
