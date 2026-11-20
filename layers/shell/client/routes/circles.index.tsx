import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import TribesPage from '@/modules/tribes/client/components/TribesPage.component';
import { circlesQuery } from '@/modules/tribes/client/api/circle-queries';
import useMembershipUpdated from '@/modules/tribes/client/hooks/useMembershipUpdated';
import { useAuth } from '@/modules/core/client/react-app/auth';
import { routeOptions } from '../route-options';

function TribesPageRoute() {
  const { user } = useAuth();
  const onMembershipUpdated = useMembershipUpdated();
  return (
    <TribesPage
      onMembershipUpdated={onMembershipUpdated}
      user={user as React.ComponentProps<typeof TribesPage>['user']}
    />
  );
}

export const Route = createFileRoute('/circles/')({
  ...routeOptions('/circles', TribesPageRoute),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(circlesQuery(context.user?._id));
  },
});
