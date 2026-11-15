import React from 'react';

import './tribes-list.css';

import Tribe from './Tribe';
import type { MembershipUpdate, TribeSummary } from '../api/tribes.api';
import type { UserProfile } from '@/modules/users/client/types';

export default function TribesList({
  tribes,
  user,
  onMembershipUpdated,
}: {
  tribes: TribeSummary[];
  user?: UserProfile;
  onMembershipUpdated: (data: MembershipUpdate) => void;
}) {
  return (
    <ul className="list-unstyled tribes-grid tribes-list">
      {tribes.map(tribe => (
        <li className="tribes-list-item" key={tribe._id}>
          <Tribe
            tribe={tribe}
            user={user}
            onMembershipUpdated={onMembershipUpdated}
          />
        </li>
      ))}
    </ul>
  );
}
