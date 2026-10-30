import React from 'react';

import { useAuth, type AuthUser } from '@/modules/core/client/react-app/auth';
import type {
  RouteContext,
  RouteRender,
} from '@/modules/core/client/react-app/route-render';
import TribesPage from '@/modules/tribes/client/components/TribesPage.component';
import TribeDetailPage from '@/modules/tribes/client/components/TribeDetailPage.component';

function useMembershipUpdated(user: AuthUser | null) {
  const { setUser } = useAuth();

  return (data: { user?: Partial<AuthUser> } | null) => {
    /* istanbul ignore else -- malformed membership callbacks cannot update auth state. */
    if (data?.user) {
      setUser({ ...user, ...data.user, roles: user?.roles });
    }
  };
}

function TribesPageRoute({ user }: RouteContext) {
  return (
    <TribesPage
      onMembershipUpdated={useMembershipUpdated(user)}
      user={user as React.ComponentProps<typeof TribesPage>['user']}
    />
  );
}

function TribeDetailPageRoute({ user, params }: RouteContext) {
  return (
    <TribeDetailPage
      circle={params.circle}
      onMembershipUpdated={useMembershipUpdated(user)}
      user={user as React.ComponentProps<typeof TribeDetailPage>['user']}
    />
  );
}

export const tribesRoutes: Record<string, RouteRender> = {
  '/circles': props => <TribesPageRoute {...props} />,
  '/circles/:circle': props => <TribeDetailPageRoute {...props} />,
};
