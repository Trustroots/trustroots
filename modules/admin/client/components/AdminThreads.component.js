// External dependencies
import classnames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';

// Internal dependencies
import { getThreads } from '../api/threads.api';
import AdminHeader from './AdminHeader.component';
import Json from './Json.component';
import UserLink from './UserLink.component';
import {
  MONGO_OBJECT_ID_LENGTH,
  isMongoObjectId,
  normalizeAdminQuery,
} from './userSearch.helpers';
import TimeAgo from '@/modules/core/client/components/TimeAgo';

export default function AdminThreads() {
  // @TODO: replace with useLocation of react-router or similar.
  const urlParams = new URLSearchParams(window.location.search);
  const urlUserId = urlParams.get('userId');
  const initialQuery = urlUserId || urlParams.get('username') || '';

  const [queried, setQueried] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [threads, setThreads] = useState([]);

  const runQuery = useCallback(async queryValue => {
    const trimmedQuery = normalizeAdminQuery(queryValue);
    const userId = isMongoObjectId(trimmedQuery) ? trimmedQuery : '';
    const username = userId ? '' : trimmedQuery;

    const result = await getThreads({ userId, username });
    setQueried(true);
    if (result) {
      setThreads(result);
    }
  }, []);

  useEffect(() => {
    if (initialQuery) {
      void runQuery(initialQuery);
    }
  }, [initialQuery, runQuery]);

  function onSubmit(event) {
    event.preventDefault();
    void runQuery(query);
  }

  function renderResults() {
    if (!queried && threads.length === 0) {
      return null;
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
            aria-label="Member username or ID"
            className="form-control input-lg"
            name="query"
            onChange={({ target: { value } }) => setQuery(value)}
            placeholder="Member username or ID"
            size={MONGO_OBJECT_ID_LENGTH + 2}
            type="text"
            value={query}
          />
          <button
            className="btn btn-lg btn-default"
            type="submit"
            disabled={!query.trim()}
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
