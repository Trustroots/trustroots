import React, { useEffect, useState } from 'react';
import { Button } from '@trustroots/ui/Button';
import { getGravatarUsage, type GravatarUsage } from '../api/gravatar.api';
import { formatAdminDateTime } from '../utils/admin-date';
import AdminHeader from './AdminHeader.component';

export default function AdminGravatar() {
  const [page, setPage] = useState(1);
  const [usage, setUsage] = useState<GravatarUsage | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setUsage(null);
    setFailed(false);
    getGravatarUsage(page)
      .then(result => {
        if (active) setUsage(result);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [page]);

  return (
    <>
      <AdminHeader />
      <div className="container">
        <h2>Gravatar usage</h2>
        <p>
          Members currently using Gravatar. Existing images remain available
          while the retirement approach is agreed.
        </p>
        {failed && <p role="alert">Could not load Gravatar usage.</p>}
        {!usage && !failed && <p role="status">Loading Gravatar usage…</p>}
        {usage && (
          <>
            <p>
              <strong>{usage.accounts}</strong> accounts currently use Gravatar.
            </p>
            <p>
              Measured at{' '}
              <time dateTime={usage.measuredAt}>
                {formatAdminDateTime(usage.measuredAt)}
              </time>{' '}
              UTC.
            </p>
            {usage.members.length === 0 ? (
              <p>No Gravatar members on this page.</p>
            ) : (
              <table
                className="table table-striped"
                aria-label="Gravatar members"
              >
                <thead>
                  <tr>
                    <th scope="col">Username</th>
                    <th scope="col">Display name</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.members.map(member => (
                    <tr key={member._id}>
                      <td>
                        <a href={`/admin/user/${member.username}`}>
                          {member.username}
                        </a>
                      </td>
                      <td>{member.displayName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <nav aria-label="Gravatar member pages">
              <Button
                disabled={usage.page === 1}
                onClick={() => setPage(usage.page - 1)}
              >
                Previous
              </Button>
              <span> Page {usage.page} </span>
              <Button
                disabled={!usage.hasNextPage}
                onClick={() => setPage(usage.page + 1)}
              >
                Next
              </Button>
            </nav>
          </>
        )}
      </div>
    </>
  );
}
