import { createRoute } from '@tanstack/react-router';
import React from 'react';
import TribeDetailPage from '@/modules/tribes/client/components/TribeDetailPage.component';
import { useAuth, type AuthUser } from '@/modules/core/client/react-app/auth';
import { routeOptions, type RouteContext } from '../route-options';

function TribeDetailPageRoute({
  user,
  circle,
}: {
  user: AuthUser | null;
  circle?: string;
}) {
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
    <TribeDetailPage
      circle={circle as string}
      onMembershipUpdated={handleMembershipUpdated}
      user={user as React.ComponentProps<typeof TribeDetailPage>['user']}
    />
  );
}

function renderCircleDetail({ user, params }: RouteContext) {
  return React.createElement(
    TribeDetailPageRoute as unknown as React.ComponentType<{
      user: AuthUser | null;
      circle?: string;
    }>,
    {
      user,
      circle: params.circle,
    },
  );
}

export const Route = createRoute(
  routeOptions('/circles/:circle', renderCircleDetail),
);
