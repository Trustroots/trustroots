import React, { useEffect, useState } from 'react';
import { Button } from '@trustroots/ui/Button';
import { load, type Page, type SupportMember } from '../api/support.api';
import AdminHeader from './AdminHeader.component';
import UserState from './UserState.component';
type FlaggedMember = Pick<
  SupportMember,
  '_id' | 'username' | 'displayName' | 'public' | 'roles'
>;

export default function FlaggedMembers() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<FlaggedMember> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setData(null);
    setFailed(false);
    load<Page<FlaggedMember>>(`/api/admin/support-flagged-members?page=${page}`)
      .then(result => {
        if (active) setData(result);
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
      <main className="container">
        <h1>Flagged members</h1>
        <p>
          Profiles flagged for internal moderation follow-up. Flags do not
          suspend or ban members.
        </p>
        {failed && <p role="alert">Could not load flagged members.</p>}
        {!failed && !data && <p role="status">Loading flagged members…</p>}
        {data && (
          <>
            {data.items.length === 0 ? (
              <p>No flagged members on this page.</p>
            ) : (
              <table
                className="table table-striped"
                aria-label="Flagged members"
              >
                <thead>
                  <tr>
                    <th scope="col">Member</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(member => (
                    <tr key={member._id}>
                      <td>
                        <a
                          href={`/admin/support/member/${encodeURIComponent(member.username)}`}
                        >
                          {member.username} ({member.displayName})
                        </a>
                      </td>
                      <td>
                        <UserState user={member} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <nav aria-label="Flagged member pages">
              <Button
                disabled={data.page === 1}
                onClick={() => setPage(data.page - 1)}
              >
                Previous
              </Button>
              <span> Page {data.page} </span>
              <Button
                disabled={!data.hasMore}
                onClick={() => setPage(data.page + 1)}
              >
                Next
              </Button>
            </nav>
          </>
        )}
      </main>
    </>
  );
}
