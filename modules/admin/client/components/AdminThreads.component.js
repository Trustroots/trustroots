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
  // @TODO: replace with useLocation of react-router or similar.
  const urlParams = new URLSearchParams(window.location.search);
  const urlUserId = urlParams.get('userId');
  const initialUsername = urlParams.get('username') || '';
  const initialUserId =
    urlUserId && urlUserId.length === MONGO_OBJECT_ID_LENGTH ? urlUserId : '';

  const [queried, setQueried] = useState(false);
  const [threads, setThreads] = useState([]);
  const [userId, setUserId] = useState(initialUserId);
  const [username, setUsername] = useState(initialUsername);

  async function onSubmit(event) {
    event.preventDefault();

    // Mongo ObjectId is always 24 chars long
    if (!username && userId && userId.length !== MONGO_OBJECT_ID_LENGTH) {
      alert('User ID is wrong length');
      return;
    }

    const threads = await getThreads({ userId, username });
    setQueried(true);
    if (threads) {
      setThreads(threads);
    }
  }

  function renderResults() {
    if (!queried && threads.length === 0) {
      return (
        <p>
          <em className="text-muted">
            {userId ? 'Press "Query"' : 'Enter member ID or username…'}
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
            disabled={username.length > 0}
          />
          <em> or </em>
          <input
            aria-label="Username"
            className="form-control input-lg"
            name="userId"
            onChange={({ target: { value } }) => setUsername(value)}
            placeholder="Username"
            size={20}
            type="text"
            value={username}
            disabled={userId.length > 0}
          />
          <button
            className="btn btn-lg btn-default"
            type="submit"
            disabled={!username.length && !userId.length}
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
