// External dependencies
import React, { useEffect, useState } from 'react';

import * as api from '../api/admin-reference-threads.api';
import TimeAgo from '@/modules/core/client/components/TimeAgo';
import UserLink from './UserLink.component';
import AdminHeader from './AdminHeader.component';

/**
 * Lists threads that received negative references
 */
export default function AdminReferenceThreads() {
  const [isFetching, setIsFetching] = useState(false);
  const [referenceThreads, setReferenceThreads] = useState([]);

  async function fetchReferenceThreads() {
    setIsFetching(true);
    try {
      const results = await api.getReferenceThreads();
      setReferenceThreads(results);
    } catch {
      // eslint-disable-next-line no-console
      console.log(`Could not load reference threads`);
    } finally {
      setIsFetching(false);
    }
  }

  useEffect(() => {
    fetchReferenceThreads();
  }, []);

  return (
    <>
      <AdminHeader />
      <div className="container">
        <h2>Reference Threads</h2>
        <p>500 latest negative reference threads.</p>
        {isFetching && <p>Loading reference threads...</p>}
        {!isFetching &&
          referenceThreads.length > 0 &&
          referenceThreads.map(({ _id, userFrom, userTo, created }) => {
            const userToId = userTo?._id ?? userTo;
            const userFromId = userFrom?._id ?? userFrom;

            return (
              <div key={_id} className="panel">
                <div className="panel-body">
                  <p>
                    <TimeAgo date={new Date(created)} />
                    {' by '}
                    <UserLink user={userFrom} />
                    {' for '}
                    <UserLink user={userTo} />
                  </p>
                  <p>
                    <a
                      href={`/admin/messages?userId1=${userToId}&userId2=${userFromId}`}
                    >
                      See message thread
                    </a>
                  </p>
                </div>
              </div>
            );
          })}
      </div>
    </>
  );
}

AdminReferenceThreads.propTypes = {};
