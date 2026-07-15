// External dependencies
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';

import * as api from '../api/admin-reference-threads.api';
import TimeAgo from '@/modules/core/client/components/TimeAgo';
import UserLink from './UserLink.component';
import AdminHeader from './AdminHeader.component';

function ReferenceUser({ user }) {
  if (user && user._id) {
    return <UserLink user={user} />;
  }
  return <em>Unknown member</em>;
}

ReferenceUser.propTypes = {
  user: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
};

/**
 * Lists threads that received negative references
 */
export default function AdminReferenceThreads() {
  const [isFetching, setIsFetching] = useState(false);
  const [referenceThreads, setReferenceThreads] = useState([]);
  const [topNegativeRecipients, setTopNegativeRecipients] = useState([]);

  async function fetchReferenceThreads() {
    setIsFetching(true);
    try {
      const results = await api.getReferenceThreads();
      setReferenceThreads(Array.isArray(results) ? results : results.items);
      setTopNegativeRecipients(
        Array.isArray(results) ? [] : results.topNegativeRecipients || [],
      );
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
        {topNegativeRecipients.length > 0 && (
          <div className="panel panel-default">
            <div className="panel-body">
              <h4>Top score</h4>
              <ol className="list-inline">
                {topNegativeRecipients.map(({ count, user }) => {
                  const userId = user?._id ?? user;
                  return (
                    <li key={userId}>
                      <span className="label label-danger">{count}</span>{' '}
                      <ReferenceUser user={user} />
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        )}
        {isFetching && <p>Loading reference threads...</p>}
        {!isFetching && referenceThreads.length > 0 && (
          <table className="table table-condensed table-striped">
            <thead>
              <tr>
                <th>When</th>
                <th>By</th>
                <th>For</th>
                <th>Messages</th>
              </tr>
            </thead>
            <tbody>
              {referenceThreads.map(({ _id, userFrom, userTo, created }) => {
                const userToId = userTo?._id ?? userTo;
                const userFromId = userFrom?._id ?? userFrom;

                return (
                  <tr key={_id}>
                    <td>
                      <TimeAgo date={new Date(created)} />
                    </td>
                    <td>
                      <ReferenceUser user={userFrom} />
                    </td>
                    <td>
                      <ReferenceUser user={userTo} />
                    </td>
                    <td>
                      <a
                        href={`/admin/messages?userId1=${userToId}&userId2=${userFromId}`}
                      >
                        See messages
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

AdminReferenceThreads.propTypes = {};
