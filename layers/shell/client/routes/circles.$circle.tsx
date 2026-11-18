import { createFileRoute, useParams } from '@tanstack/react-router';
import React from 'react';
import TribeDetailPage from '@/modules/tribes/client/components/TribeDetailPage.component';
import { useAuth } from '@/modules/core/client/react-app/auth';
import { routeOptions } from '../route-options';
import { useMembershipUpdated } from './circles.index';

function TribeDetailPageRoute() {
  const { user } = useAuth();
  const { circle } = useParams({ from: '/circles/$circle' });
  return (
    <TribeDetailPage
      circle={circle}
      onMembershipUpdated={useMembershipUpdated()}
      user={user as React.ComponentProps<typeof TribeDetailPage>['user']}
    />
  );
}

export const Route = createFileRoute('/circles/$circle')(
  routeOptions('/circles/:circle', TribeDetailPageRoute),
);
