import { useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';

import TribesHeader from './TribesHeader';
import TribesList from './TribesList';
import TribesJoinTrustroots from './TribesJoinTrustroots';

import { circlesQuery } from '../api/circle-queries';
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
  const { data: tribes = [] } = useQuery(circlesQuery);

  const handleMembershipUpdated = (data: MembershipUpdate) => {
    // update the tribes in state

    /**
     * When user's membership in a tribe changes
     * replace the tribe in react state with the new tribe returned by API
     * and update the state with a new array of tribes.
     * @TODO extract the mapReplace method to be reusable
     * https://github.com/Trustroots/trustroots/pull/1145#discussion_r368321566
     */
    queryClient.setQueryData(circlesQuery.queryKey, tribes =>
      tribes?.map(tribe =>
        data.tribe && tribe._id === data.tribe._id ? data.tribe : tribe,
      ),
    );

    onMembershipUpdated(data);
  };

  return (
    <>
      <TribesHeader isLoggedIn={!!user} />

      <section className="container">
        <div className="row">
          <div className="col-xs-12">
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
