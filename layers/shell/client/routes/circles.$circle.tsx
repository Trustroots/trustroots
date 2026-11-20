import { createFileRoute, useParams } from '@tanstack/react-router';
import React from 'react';
import TribeDetailPage from '@/modules/tribes/client/components/TribeDetailPage.component';
import useMembershipUpdated from '@/modules/tribes/client/hooks/useMembershipUpdated';
import { useAuth } from '@/modules/core/client/react-app/auth';
import { routeOptions } from '../route-options';

function TribeDetailPageRoute() {
  const { user } = useAuth();
  const { circle } = useParams({ from: '/circles/$circle' });
  const onMembershipUpdated = useMembershipUpdated();
  return (
    <TribeDetailPage
      circle={circle}
      onMembershipUpdated={onMembershipUpdated}
      user={user as React.ComponentProps<typeof TribeDetailPage>['user']}
    />
  );
}

export const Route = createFileRoute('/circles/$circle')(
  routeOptions('/circles/:circle', TribeDetailPageRoute),
);
