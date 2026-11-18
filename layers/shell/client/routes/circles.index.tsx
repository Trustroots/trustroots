import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import TribesPage from '@/modules/tribes/client/components/TribesPage.component';
import { useAuth, type AuthUser } from '@/modules/core/client/react-app/auth';
import { routeOptions } from '../route-options';

export function useMembershipUpdated() {
  const { user, setUser } = useAuth();
  return (data: { user?: Partial<NonNullable<AuthUser>> } | null) => {
    /* istanbul ignore else -- malformed membership callbacks cannot update auth state. */
    if (data?.user) {
      setUser({ ...user, ...data.user, roles: user?.roles });
    }
  };
}

function TribesPageRoute() {
  const { user } = useAuth();
  return (
    <TribesPage
      onMembershipUpdated={useMembershipUpdated()}
      user={user as React.ComponentProps<typeof TribesPage>['user']}
    />
  );
}

export const Route = createFileRoute('/circles/')(
  routeOptions('/circles', TribesPageRoute),
);
