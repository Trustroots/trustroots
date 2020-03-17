// External dependencies
import classnames from 'classnames';
import React, { useState } from 'react';

// Internal dependencies
import { getThreads } from '../api/threads.api';
import AdminHeader from './AdminHeader.component';
import Json from './Json.component';
import UserLink from './UserLink.component';
import TimeAgo from '@/modules/core/client/components/TimeAgo';

// Mongo ObjectId is always 24 chars long
const MONGO_OBJECT_ID_LENGTH = 24;

export default function AdminThreads() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlUserId = urlParams.get('userId');
  const initialUserId =
    urlUserId && urlUserId.length === MONGO_OBJECT_ID_LENGTH ? urlUserId : '';

  const [queried, setQueried] = useState(false);
  const [threads, setThreads] = useState([]);
  const [userId, setUserId] = useState(initialUserId);

  async function onSubmit(event) {
    if (event) {
      event.preventDefault();
    }
    // Mongo ObjectId is always 24 chars long
    if (userId && userId.length === MONGO_OBJECT_ID_LENGTH) {
      const threads = await getThreads(userId);
      setThreads(threads);
      setQueried(true);
    }
  }

  function renderResults() {
    if (!queried && threads.length === 0) {
      return (
        <p>
          <em className="text-muted">
            {userId ? 'Press "Query"' : 'Enter member ID…'}
          </em>
        </p>
      );
    }

    if (queried && threads.length === 0) {
      return (
        <div className="alert alert-info">
          <em>Nothing found…</em>
        </div>
      );
    }

    return (
      <>
        <h3>Messages from/to them</h3>
        {threads.map(thread => {
          const { _id } = thread;
          return (
            <div className="panel panel-default" key={_id}>
              <div className="panel-body">
                <p>
                  <UserLink user={thread.userFromProfile[0]} />
                  {' → '}
                  <UserLink user={thread.userToProfile[0]} />
                  <span
                    className={classnames('label pull-right', {
                      'label-success': thread.read,
                      'label-warning': !thread.read,
                    })}
                  >
                    {thread.read ? 'Read' : 'Unread'}
                  </span>
                </p>
                <p>
                  <TimeAgo date={new Date(thread.updated)} />
                  {` (${thread.updated}) `}
                  <a
                    href={`/admin/messages?userId1=${thread.userFromProfile[0]?._id}&userId2=${thread.userToProfile[0]?._id}`}
                  >
                    Read thread
                  </a>
                </p>
                <details>
                  <summary>Thread details</summary>
                  <Json content={thread} />
                </details>
              </div>
            </div>
          );
        })}
      </>
    );
  }

  return (
    <>
      <AdminHeader />
      <div className="container">
        <h2>Threads</h2>
        <form className="form-inline" onSubmit={event => onSubmit(event)}>
          <input
            aria-label="Member ID"
            className="form-control input-lg"
            maxLength={MONGO_OBJECT_ID_LENGTH}
            name="userId"
            onChange={({ target: { value } }) => setUserId(value)}
            placeholder="Member ID"
            size={MONGO_OBJECT_ID_LENGTH + 2}
            type="text"
            value={userId}
          />
          <button
            className="btn btn-lg btn-default"
            disabled={userId.length !== MONGO_OBJECT_ID_LENGTH}
            type="submit"
          >
            Query
          </button>
        </form>
        <br />
        {renderResults()}
      </div>
    </>
  );
}

AdminThreads.propTypes = {};
