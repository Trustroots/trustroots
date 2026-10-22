import React, { useEffect, useState } from 'react';

import {
  getUsernameChanges,
  type AdminUsernameChange,
  type AdminUsernameChangeRange,
} from '../api/username-changes.api';
import { formatAdminDateTime } from '../utils/admin-date';
import AdminHeader from './AdminHeader.component';
import UserLink from './UserLink.component';

function ChangeTimestamp({ value }: { value?: string }) {
  if (!value || Number.isNaN(new Date(value).getTime())) return <>—</>;
  const date = new Date(value).toISOString();
  return <time dateTime={date}>{formatAdminDateTime(value)}</time>;
}

function PreviousUsername({ change }: { change: AdminUsernameChange }) {
  if (change.oldUsername) return <span>{change.oldUsername}</span>;
  return (
    <span
      className="text-muted"
      title="The previous username was not recorded before history tracking began."
    >
      Not recorded
    </span>
  );
}

export default function AdminUsernameChanges() {
  const [page, setPage] = useState(1);
  const [range, setRange] = useState<AdminUsernameChangeRange>(() =>
    new URLSearchParams(window.location.search).get('range') === 'all'
      ? 'all'
      : '90d',
  );
  const [changes, setChanges] = useState<AdminUsernameChange[]>([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    getUsernameChanges(page, range)
      .then(result => {
        if (active) {
          setChanges(result.changes);
          setHasNextPage(result.hasNextPage);
        }
      })
      .catch(() => {
        if (active) {
          setChanges([]);
          setHasNextPage(false);
          setFailed(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, range]);

  function changeRange(value: AdminUsernameChangeRange) {
    setRange(value);
    setPage(1);
    const url = new URL(window.location.href);
    if (value === 'all') url.searchParams.set('range', 'all');
    else url.searchParams.delete('range');
    window.history.replaceState(window.history.state, '', url);
  }

  return (
    <>
      <AdminHeader />
      <div className="container">
        <h2>Recent username changes</h2>
        <p>Review recorded old and new usernames for each member.</p>
        <p className="text-muted">Times in UTC.</p>

        <label htmlFor="username-change-range">Date range</label>
        <select
          className="form-control"
          id="username-change-range"
          onChange={event =>
            changeRange(event.target.value as AdminUsernameChangeRange)
          }
          value={range}
        >
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </select>

        {failed && <p role="alert">Could not load username change history.</p>}
        {loading && <p role="status">Loading username changes…</p>}
        {!loading && !failed && changes.length === 0 && <p>Nothing found…</p>}
        {!loading && !failed && changes.length > 0 && (
          <>
            <div className="table-responsive">
              <table
                className="table table-striped"
                aria-label="Username changes"
              >
                <thead>
                  <tr>
                    <th scope="col">Member</th>
                    <th scope="col">Old username</th>
                    <th scope="col">New username</th>
                    <th scope="col">Changed at</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map(change => (
                    <tr
                      key={`${change._id}-${change.changedAt}-${change.newUsername}`}
                    >
                      <td>
                        <UserLink
                          user={{
                            _id: change._id,
                            username: change.currentUsername,
                            displayName: change.displayName,
                          }}
                        />
                      </td>
                      <td>
                        <PreviousUsername change={change} />
                      </td>
                      <td>{change.newUsername}</td>
                      <td>
                        <ChangeTimestamp value={change.changedAt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {!loading && !failed && (page > 1 || hasNextPage) && (
          <nav aria-label="Username changes pages">
            <button
              className="btn btn-default"
              disabled={page === 1}
              onClick={() => setPage(currentPage => currentPage - 1)}
              type="button"
            >
              Previous
            </button>{' '}
            <span>Page {page}</span>{' '}
            <button
              className="btn btn-default"
              disabled={!hasNextPage}
              onClick={() => setPage(currentPage => currentPage + 1)}
              type="button"
            >
              Next
            </button>
          </nav>
        )}
      </div>
    </>
  );
}
