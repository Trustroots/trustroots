import { createRoute } from '@tanstack/react-router';
import React from 'react';
import TribesPage from '@/modules/tribes/client/components/TribesPage.component';
import { useAuth, type AuthUser } from '@/modules/core/client/react-app/auth';
import {
  routeOptions,
  renderWithUser,
  type RouteContext,
} from '../route-options';

function TribesPageRoute({ user }: RouteContext) {
  const { setUser } = useAuth();

  const handleMembershipUpdated = (
    data: { user?: Partial<NonNullable<AuthUser>> } | null,
  ) => {
    /* istanbul ignore else -- malformed membership callbacks cannot update auth state. */
    if (data?.user) {
      setUser({ ...user, ...data.user, roles: user?.roles });
    }
  };

  return (
    <TribesPage
      onMembershipUpdated={handleMembershipUpdated}
      user={user as React.ComponentProps<typeof TribesPage>['user']}
    />
  );
}

export const Route = createRoute(
  routeOptions('/circles', renderWithUser(TribesPageRoute)),
);
