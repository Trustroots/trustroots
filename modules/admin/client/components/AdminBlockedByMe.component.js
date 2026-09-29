import React, { useEffect, useState } from 'react';
import AdminHeader from './AdminHeader.component';
import { getMembersWhoBlockedMe } from '../api/blocked-by-me.api';

export default function AdminBlockedByMe() {
  const [members, setMembers] = useState(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    getMembersWhoBlockedMe()
      .then(setMembers)
      .catch(() => setHasError(true));
  }, []);

  return (
    <>
      <AdminHeader />
      <main className="container">
        <h2>Members who blocked you</h2>
        <p>Visible to administrators and Welcome team members for support.</p>
        {hasError ? (
          <p role="alert">Could not load members. Please try again later.</p>
        ) : members === null ? (
          <p>Loading members…</p>
        ) : members.length === 0 ? (
          <p>No members have blocked your account.</p>
        ) : (
          <ul>
            {members.map(member => (
              <li key={member._id}>
                {member.displayName || member.username || 'Member'}
                {member.username && ` (@${member.username})`}
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

AdminBlockedByMe.propTypes = {};
