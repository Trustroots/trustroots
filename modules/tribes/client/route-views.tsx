import React from 'react';
import TribeDetailPage from './components/TribeDetailPage.component';
import useMembershipUpdated from './hooks/useMembershipUpdated';
import { useAuth } from '@/modules/core/client/react-app/auth';
import TribesPage from './components/TribesPage.component';

export function TribeDetailPageRoute({ circle }: { circle: string }) {
  const { user } = useAuth();
  const onMembershipUpdated = useMembershipUpdated();
  return (
    <TribeDetailPage
      circle={circle}
      onMembershipUpdated={onMembershipUpdated}
      user={user as React.ComponentProps<typeof TribeDetailPage>['user']}
    />
  );
}

export function TribesPageRoute() {
  const { user } = useAuth();
  const onMembershipUpdated = useMembershipUpdated();
  return (
    <TribesPage
      onMembershipUpdated={onMembershipUpdated}
      user={user as React.ComponentProps<typeof TribesPage>['user']}
    />
  );
}
