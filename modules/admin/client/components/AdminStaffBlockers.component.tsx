import React, { useEffect, useState } from 'react';
import AdminHeader from './AdminHeader.component';
import { getAdminUserHref } from '../utils/member-url';
import { getStaffBlockers } from '../api/staff-blockers.api';
import { useAuth } from '../../../core/client/react-app/auth';
import type { StaffBlocker } from '../../shared/staff-blockers';

export default function AdminStaffBlockers() {
  const [staff, setStaff] = useState<StaffBlocker[] | null>(null);
  const [hasError, setHasError] = useState(false);
  const isAdmin = useAuth().hasRole('admin');

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
          <p>Review members who have blocked any administrator or greeter.</p>
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
                  <a href={getAdminUserHref(member)}>
                    {member.displayName || member.username || 'Staff member'}
                    {member.username && ` (@${member.username})`}
                  </a>
                </h3>
                <ul>
                  {member.blockedBy.map(blocker => (
                    <li key={blocker._id}>
                      <a href={getAdminUserHref(blocker)}>
                        {blocker.displayName || blocker.username || 'Member'}
                        {blocker.username && ` (@${blocker.username})`}
                      </a>
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
