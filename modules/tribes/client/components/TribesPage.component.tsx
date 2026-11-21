import { useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';

import TribesHeader from './TribesHeader';
import TribesList from './TribesList';
import TribesJoinTrustroots from './TribesJoinTrustroots';

import { circlesQuery, setCachedCircle } from '../api/circle-queries';
import type { MembershipUpdate } from '../api/tribes.api';
import type { UserProfile } from '@/modules/users/client/types';

export default function TribesPage({
  user,
  onMembershipUpdated,
}: {
  user?: UserProfile;
  onMembershipUpdated: (data: MembershipUpdate) => void;
}) {
  const queryClient = useQueryClient();
  const { data: tribes = [] } = useQuery(circlesQuery(user?._id));

  const handleMembershipUpdated = (data: MembershipUpdate) => {
    if (data.tribe) {
      setCachedCircle(queryClient, data.tribe);
    }
    onMembershipUpdated(data);
  };

  return (
    <>
      <TribesHeader isLoggedIn={!!user} />

      <section className="tw:page-container">
        <div className="tw:grid-row">
          <div className="tw:grid-col-12">
            <TribesList
              tribes={tribes}
              user={user}
              onMembershipUpdated={handleMembershipUpdated}
            />
          </div>
        </div>

        {!user && <TribesJoinTrustroots />}
      </section>
    </>
  );
}
