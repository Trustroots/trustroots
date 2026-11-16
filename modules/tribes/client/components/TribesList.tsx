import React from 'react';

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
    <ul className="list-unstyled tribes-grid tw:mx-[-5px] tw:mt-[-5px] tw:mb-[15px]">
      {tribes.map(tribe => (
        <li
          className="tw:inline-block tw:w-full tw:p-[5px] tw:align-bottom tw:min-[616px]:w-1/2 tw:md:w-1/3"
          key={tribe._id}
        >
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
