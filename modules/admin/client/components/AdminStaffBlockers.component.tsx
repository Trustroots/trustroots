import React, { useEffect, useState } from 'react';
import AdminHeader from './AdminHeader.component';
import { getStaffBlockers } from '../api/staff-blockers.api';
import { getCurrentUser } from '../../../core/client/services/client-runtime';
import type { StaffBlocker } from '../../shared/staff-blockers';

export default function AdminStaffBlockers() {
  const [staff, setStaff] = useState<StaffBlocker[] | null>(null);
  const [hasError, setHasError] = useState(false);
  const isAdmin = (getCurrentUser()?.roles || []).includes('admin');

  useEffect(() => {
    getStaffBlockers()
      .then(setStaff)
      .catch(() => setHasError(true));
  }, []);

  return (
    <>
      <AdminHeader />
      <main className="container">
        <h2>
          {isAdmin ? 'Members who blocked staff' : 'Members who blocked you'}
        </h2>
        {isAdmin && (
          <p>
            Review members who have blocked any administrator or Welcome team
            member.
          </p>
        )}
        {hasError ? (
          <p role="alert">Could not load members. Please try again later.</p>
        ) : staff === null ? (
          <p>Loading members…</p>
        ) : staff.every(member => member.blockedBy.length === 0) ? (
          <p>
            {isAdmin
              ? 'No members have blocked staff accounts.'
              : 'No members have blocked your account.'}
          </p>
        ) : (
          staff
            .filter(member => member.blockedBy.length > 0)
            .map(member => (
              <section key={member._id}>
                <h3>
                  {member.displayName || member.username || 'Staff member'}
                  {member.username && ` (@${member.username})`}
                </h3>
                <ul>
                  {member.blockedBy.map(blocker => (
                    <li key={blocker._id}>
                      {blocker.displayName || blocker.username || 'Member'}
                      {blocker.username && ` (@${blocker.username})`}
                    </li>
                  ))}
                </ul>
              </section>
            ))
        )}
      </main>
    </>
  );
}
